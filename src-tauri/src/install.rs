//! Native first-launch installation. Call on a worker thread after dialog initialization.
//! This preserves quarantine and signatures; it never changes macOS security settings.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LaunchDecision {
    Continue,
    Relaunched,
}

/// Installer launches must not acquire the installed app's single-instance lock.
pub fn is_installer_launch() -> bool {
    #[cfg(target_os = "macos")]
    {
        std::env::current_exe().is_ok_and(|path| macos::installer_executable(&path))
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

pub fn prepare_launch(app: tauri::AppHandle) -> Result<LaunchDecision, String> {
    #[cfg(target_os = "macos")]
    return macos::prepare(app);
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(LaunchDecision::Continue)
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::LaunchDecision;
    use plist::{Dictionary, Value};
    use std::{
        fs::{self, File, OpenOptions},
        io::{Cursor, Read, Write},
        os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt},
        path::{Component, Path, PathBuf},
        process::Command,
        thread,
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };
    use tauri::Manager;
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    const SESSION_ARG: &str = "--cinematic-install-session=";
    const SESSION_LIFETIME_MS: u64 = 10 * 60 * 1000;
    const HANDOFF_TIMEOUT: Duration = Duration::from_secs(25);

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct MountedImage {
        image: PathBuf,
        mount: PathBuf,
        device: String,
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct Fingerprint {
        device: u64,
        inode: u64,
        length: u64,
        modified_seconds: i64,
        modified_nanos: i64,
    }

    #[derive(Debug)]
    struct InstallSession {
        nonce: String,
        identifier: String,
        target: PathBuf,
        mounted: MountedImage,
        fingerprint: Fingerprint,
        parent_pid: u32,
        created_ms: u64,
        cleanup_requested: bool,
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct SignedIdentity {
        identifier: String,
        version: String,
        short_version: String,
        cd_hash: String,
    }

    pub(super) fn prepare(app: tauri::AppHandle) -> Result<LaunchDecision, String> {
        let Some(bundle) = bundle_for_executable(&std::env::current_exe().map_err(display)?) else {
            return Ok(LaunchDecision::Continue);
        };
        let bundle = fs::canonicalize(bundle).map_err(display)?;
        let identifier = &app.config().identifier;
        if bundle_identifier(&bundle).as_deref() != Some(identifier.as_str()) {
            return Err("The running app does not match its bundle identity.".into());
        }

        // The installed child acknowledges only a fresh private marker for its exact bundle.
        if let Some(nonce) =
            std::env::args().find_map(|arg| arg.strip_prefix(SESSION_ARG).map(str::to_owned))
        {
            if valid_nonce(&nonce) {
                complete_handoff(&app, &bundle, &nonce)?;
            }
            return Ok(LaunchDecision::Continue);
        }

        // An ordinary installed launch never consults mounted disks or shows installer UI.
        if !bundle_needs_installation(&bundle) {
            return Ok(LaunchDecision::Continue);
        }
        let images = mounted_images()?;
        let source = if let Some(mounted) = image_containing_bundle(&images, &bundle) {
            Some((bundle.clone(), mounted))
        } else if is_translocated(&bundle) {
            recover_translocated_source(&images, &bundle)?
        } else {
            None
        };
        let Some((source, mounted)) = source else {
            // Installed apps and ambiguous installer matches never authorize cleanup.
            return Ok(LaunchDecision::Continue);
        };
        validate_image_file(&mounted.image)?;
        let home = app.path().home_dir().map_err(display)?;
        let applications = writable_applications_directory(&home)?;
        let filename = source.file_name().ok_or("The app bundle has no name.")?;
        let target = applications.join(filename);
        let replace = if target.exists() || fs::symlink_metadata(&target).is_ok() {
            validate_existing_bundle(&target, identifier)?;
            if bundle_is_running(&target)? {
                notice(&app, "Quit the existing app first", "The installed app is still running. Quit it, then open this installer again. Your existing app and this installer have been kept.");
                return Ok(LaunchDecision::Continue);
            }
            true
        } else {
            false
        };

        let action = if replace {
            "Replace and open"
        } else {
            "Install and open"
        };
        let message = installation_message(app_name(&app), &target, &mounted.image, replace);
        if !ask(&app, &message, action, "Not now") {
            return Ok(LaunchDecision::Continue);
        }

        let nonce = random_nonce()?;
        let staged = applications.join(format!(".cinematic-install-{nonce}.app"));
        let backup = applications.join(format!(".cinematic-previous-{nonce}.app"));
        if staged.exists() || backup.exists() {
            return Err("An installation staging path already exists. Please try again.".into());
        }
        if let Err(error) = copy_and_verify(&source, &staged, identifier) {
            let _ = fs::remove_dir_all(&staged); // Only this newly created staging copy.
            return Err(error);
        }
        if replace {
            if bundle_is_running(&target)? {
                let _ = fs::remove_dir_all(&staged);
                notice(&app, "Quit the existing app first", "The existing app was opened during installation. Quit it and try again. Both your app and installer have been kept.");
                return Ok(LaunchDecision::Continue);
            }
            if let Err(error) = fs::rename(&target, &backup) {
                let _ = fs::remove_dir_all(&staged);
                return Err(format!(
                    "Could not prepare the existing app for replacement: {error}"
                ));
            }
        }
        if let Err(error) = fs::rename(&staged, &target) {
            if replace {
                let _ = fs::rename(&backup, &target);
            }
            let _ = fs::remove_dir_all(&staged);
            return Err(format!("Could not finish installing the app: {error}"));
        }
        if replace {
            if let Err(error) = trash::delete(&backup) {
                notice(&app, "Previous app kept", &format!("The new app was installed. The previous copy could not be moved to Trash and is kept at {}.\n\n{error}", backup.display()));
            }
        }

        let session = InstallSession {
            nonce,
            identifier: identifier.to_owned(),
            target: fs::canonicalize(&target).map_err(display)?,
            fingerprint: fingerprint(&mounted.image)?,
            mounted,
            parent_pid: std::process::id(),
            created_ms: now_ms(),
            // This one consent includes verified, recoverable installer cleanup after startup.
            cleanup_requested: true,
        };
        let directory = session_directory(&app)?;
        write_session(&directory, &session)?;
        let launch = Command::new("/usr/bin/open")
            .arg("-n")
            .arg("-a")
            .arg(&target)
            .arg("--args")
            .arg(format!("{SESSION_ARG}{}", session.nonce))
            .output()
            .map_err(display)?;
        if !launch.status.success() {
            remove_session(&directory, &session.nonce);
            return Err(format!("The app was installed at {}, but macOS did not open it. Open it there and follow any Privacy & Security message.\n\n{}", target.display(), String::from_utf8_lossy(&launch.stderr).trim()));
        }
        let ack = ack_path(&directory, &session.nonce);
        let started = Instant::now();
        while started.elapsed() < HANDOFF_TIMEOUT {
            if fs::read_to_string(&ack).ok().as_deref() == Some(session.nonce.as_str()) {
                return Ok(LaunchDecision::Relaunched);
            }
            thread::sleep(Duration::from_millis(100));
        }
        // Successful `open` is not proof that a downloaded app passed Gatekeeper.
        remove_session(&directory, &session.nonce);
        Err(format!("The app was installed at {}, but the installed copy has not confirmed that it started. Open it there and follow any macOS Privacy & Security message. The installer has been kept.", target.display()))
    }

    fn complete_handoff(app: &tauri::AppHandle, bundle: &Path, nonce: &str) -> Result<(), String> {
        let directory = session_directory(app)?;
        let Some(session) = read_session(&directory, nonce)? else {
            return Ok(());
        };
        if !valid_session(&session, bundle, &app.config().identifier, now_ms()) {
            return Ok(());
        }
        // Confirm a visible installed app before its source exits or offers cleanup.
        let window = app
            .get_webview_window("main")
            .ok_or("The installed app has no main window. The installer has been kept.")?;
        window.show().map_err(display)?;
        window.set_focus().map_err(display)?;
        let ack = ack_path(&directory, nonce);
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&ack)
            .map_err(display)?;
        file.write_all(nonce.as_bytes()).map_err(display)?;
        file.sync_all().map_err(display)?;

        // Wait until the source process exits before trying to detach its disk image.
        let started = Instant::now();
        while parent_is_running(session.parent_pid)? && started.elapsed() < HANDOFF_TIMEOUT {
            thread::sleep(Duration::from_millis(100));
        }
        if parent_is_running(session.parent_pid)? {
            remove_session(&directory, nonce);
            return Ok(());
        }
        if !session.cleanup_requested || !image_is_unchanged(&session)? {
            remove_session(&directory, nonce);
            return Ok(());
        }
        // Consent was already given before copying. Revalidate without a second prompt.
        if image_is_unchanged(&session)? {
            let detached = Command::new("/usr/bin/hdiutil")
                .arg("detach")
                .arg(&session.mounted.device)
                .output()
                .map_err(display)?;
            if detached.status.success() {
                if fingerprint(&session.mounted.image).ok().as_ref() == Some(&session.fingerprint) {
                    if let Err(error) = trash::delete(&session.mounted.image) {
                        notice(app, "Installer kept", &format!("The installer disk was ejected, but the original DMG could not be moved to Trash. It is still at {}.\n\n{error}", session.mounted.image.display()));
                    }
                }
            } else {
                notice(app, "Installer kept", "The disk is still in use and could not be ejected. The installer has been kept. You can eject it in Finder later.");
            }
        }
        remove_session(&directory, nonce);
        Ok(())
    }

    fn app_name(app: &tauri::AppHandle) -> &str {
        app.config()
            .product_name
            .as_deref()
            .unwrap_or(&app.package_info().name)
    }

    fn installation_message(name: &str, target: &Path, image: &Path, replace: bool) -> String {
        let action = if replace { "Replace" } else { "Install" };
        let replacement = if replace {
            "\n\nThe previous app goes to Trash after the new copy is verified."
        } else {
            ""
        };
        format!("{action} {name} in {} and open it?{replacement}\n\nAfter it opens, eject the installer disk and move this installer to Trash:\n{}", target.parent().unwrap_or(target).display(), image.display())
    }

    fn ask(app: &tauri::AppHandle, message: &str, yes: &str, no: &str) -> bool {
        app.dialog()
            .message(message)
            .title(app_name(app))
            .buttons(MessageDialogButtons::OkCancelCustom(
                yes.to_owned(),
                no.to_owned(),
            ))
            .blocking_show()
    }

    fn notice(app: &tauri::AppHandle, title: &str, message: &str) {
        app.dialog()
            .message(message)
            .title(title)
            .kind(MessageDialogKind::Info)
            .blocking_show();
    }

    fn bundle_for_executable(executable: &Path) -> Option<PathBuf> {
        let macos = executable.parent()?;
        let contents = macos.parent()?;
        let bundle = contents.parent()?;
        (macos.file_name()? == "MacOS"
            && contents.file_name()? == "Contents"
            && bundle.extension()? == "app")
            .then(|| bundle.to_owned())
    }

    fn is_translocated(path: &Path) -> bool {
        path.components()
            .any(|component| component.as_os_str() == "AppTranslocation")
    }

    pub(super) fn installer_executable(executable: &Path) -> bool {
        bundle_for_executable(executable).is_some_and(|bundle| bundle_needs_installation(&bundle))
    }

    fn bundle_needs_installation(bundle: &Path) -> bool {
        bundle.starts_with("/Volumes") || is_translocated(bundle)
    }

    fn clean_absolute(path: &Path) -> bool {
        path.is_absolute()
            && path.parent().is_some()
            && !path
                .components()
                .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    }

    fn valid_device(device: &str) -> bool {
        device.strip_prefix("/dev/disk").is_some_and(|suffix| {
            !suffix.is_empty()
                && suffix.as_bytes()[0].is_ascii_digit()
                && suffix.bytes().all(|c| c.is_ascii_alphanumeric())
        })
    }

    fn mounted_images() -> Result<Vec<MountedImage>, String> {
        let output = Command::new("/usr/bin/hdiutil")
            .args(["info", "-plist"])
            .output()
            .map_err(display)?;
        if !output.status.success() {
            return Err("Could not identify the mounted installer disk.".into());
        }
        let value = Value::from_reader(Cursor::new(output.stdout)).map_err(display)?;
        Ok(images_from_plist(&value))
    }

    fn images_from_plist(value: &Value) -> Vec<MountedImage> {
        let Some(images) = value
            .as_dictionary()
            .and_then(|d| d.get("images"))
            .and_then(Value::as_array)
        else {
            return Vec::new();
        };
        images
            .iter()
            .flat_map(|image| {
                let Some(dict) = image.as_dictionary() else {
                    return Vec::new();
                };
                let Some(image) = dict
                    .get("image-path")
                    .and_then(Value::as_string)
                    .map(PathBuf::from)
                else {
                    return Vec::new();
                };
                if !clean_absolute(&image)
                    || image
                        .extension()
                        .and_then(|extension| extension.to_str())
                        .is_none_or(|extension| !extension.eq_ignore_ascii_case("dmg"))
                {
                    return Vec::new();
                }
                let Some(entities) = dict.get("system-entities").and_then(Value::as_array) else {
                    return Vec::new();
                };
                entities
                    .iter()
                    .filter_map(|entity| {
                        let entity = entity.as_dictionary()?;
                        let mount = PathBuf::from(entity.get("mount-point")?.as_string()?);
                        let device = entity.get("dev-entry")?.as_string()?.to_owned();
                        (clean_absolute(&mount) && valid_device(&device)).then(|| MountedImage {
                            image: image.clone(),
                            mount,
                            device,
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .collect()
    }

    fn image_containing_bundle(images: &[MountedImage], bundle: &Path) -> Option<MountedImage> {
        let mut matches = images.iter().filter(|image| {
            bundle.starts_with(&image.mount)
                && bundle != image.mount
                && !image.image.starts_with(&image.mount)
        });
        let first = matches.next()?.clone();
        matches.next().is_none().then_some(first)
    }

    fn recover_translocated_source(
        images: &[MountedImage],
        running: &Path,
    ) -> Result<Option<(PathBuf, MountedImage)>, String> {
        let Some(identity) = signed_identity(running) else {
            return Ok(None);
        };
        let mut candidates = Vec::new();
        for mounted in images {
            if validate_image_file(&mounted.image).is_err()
                || mounted.image.starts_with(&mounted.mount)
            {
                continue;
            }
            let Ok(mount) = fs::canonicalize(&mounted.mount) else {
                continue;
            };
            let Ok(entries) = fs::read_dir(&mount) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                let Ok(metadata) = fs::symlink_metadata(&path) else {
                    continue;
                };
                if !metadata.is_dir()
                    || metadata.file_type().is_symlink()
                    || path.extension().is_none_or(|extension| extension != "app")
                {
                    continue;
                }
                let Ok(path) = fs::canonicalize(path) else {
                    continue;
                };
                // Only an actual root bundle on the mounted image is eligible.
                if path.parent() != Some(mount.as_path()) {
                    continue;
                }
                if let Some(candidate_identity) = signed_identity(&path) {
                    candidates.push((path, mounted.clone(), candidate_identity));
                }
            }
        }
        Ok(unique_signed_source(&identity, candidates))
    }

    fn unique_signed_source(
        identity: &SignedIdentity,
        candidates: Vec<(PathBuf, MountedImage, SignedIdentity)>,
    ) -> Option<(PathBuf, MountedImage)> {
        let mut matches = candidates
            .into_iter()
            .filter(|(_, _, candidate)| candidate == identity);
        let (bundle, mounted, _) = matches.next()?;
        matches.next().is_none().then_some((bundle, mounted))
    }

    fn signed_identity(bundle: &Path) -> Option<SignedIdentity> {
        let value = Value::from_file(bundle.join("Contents/Info.plist")).ok()?;
        let dictionary = value.as_dictionary()?;
        let text = |key| {
            dictionary
                .get(key)
                .and_then(Value::as_string)
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
        };
        let verified = Command::new("/usr/bin/codesign")
            .args(["--verify", "--deep", "--strict"])
            .arg(bundle)
            .output()
            .ok()?;
        if !verified.status.success() {
            return None;
        }
        let details = Command::new("/usr/bin/codesign")
            .args(["--display", "--verbose=4"])
            .arg(bundle)
            .output()
            .ok()?;
        if !details.status.success() {
            return None;
        }
        let hash = cd_hash_from_output(&String::from_utf8_lossy(&details.stderr))?;
        Some(SignedIdentity {
            identifier: text("CFBundleIdentifier")?,
            version: text("CFBundleVersion")?,
            short_version: text("CFBundleShortVersionString")?,
            cd_hash: hash,
        })
    }

    fn cd_hash_from_output(output: &str) -> Option<String> {
        let mut hashes = output
            .lines()
            .filter_map(|line| line.strip_prefix("CDHash="));
        let hash = hashes.next()?;
        ((hash.len() == 40 || hash.len() == 64)
            && hash.bytes().all(|byte| byte.is_ascii_hexdigit())
            && hashes.next().is_none())
        .then(|| hash.to_ascii_lowercase())
    }

    fn validate_image_file(path: &Path) -> Result<(), String> {
        let metadata = fs::symlink_metadata(path).map_err(display)?;
        if !clean_absolute(path) || !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err("The original installer is not a regular disk image file.".into());
        }
        Ok(())
    }

    fn fingerprint(path: &Path) -> Result<Fingerprint, String> {
        validate_image_file(path)?;
        let metadata = fs::metadata(path).map_err(display)?;
        Ok(Fingerprint {
            device: metadata.dev(),
            inode: metadata.ino(),
            length: metadata.len(),
            modified_seconds: metadata.mtime(),
            modified_nanos: metadata.mtime_nsec(),
        })
    }

    fn writable_applications_directory(home: &Path) -> Result<PathBuf, String> {
        for path in [PathBuf::from("/Applications"), home.join("Applications")] {
            if fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
                continue;
            }
            if fs::create_dir_all(&path).is_err() {
                continue;
            }
            let probe = path.join(format!(".cinematic-write-{}", random_nonce()?));
            if OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&probe)
                .is_ok()
            {
                let _ = fs::remove_file(&probe);
                return fs::canonicalize(path).map_err(display);
            }
        }
        Err("Neither /Applications nor your personal Applications folder is writable.".into())
    }

    fn bundle_identifier(bundle: &Path) -> Option<String> {
        Value::from_file(bundle.join("Contents/Info.plist"))
            .ok()?
            .as_dictionary()?
            .get("CFBundleIdentifier")?
            .as_string()
            .map(str::to_owned)
    }

    fn validate_existing_bundle(path: &Path, identifier: &str) -> Result<(), String> {
        let metadata = fs::symlink_metadata(path).map_err(display)?;
        if metadata.file_type().is_symlink()
            || !metadata.is_dir()
            || bundle_identifier(path).as_deref() != Some(identifier)
        {
            return Err(format!("A different app or an unexpected file already exists at {}. It has been kept. Choose a different app name before installing.", path.display()));
        }
        Ok(())
    }

    fn bundle_is_running(bundle: &Path) -> Result<bool, String> {
        // `comm` contains executable names, not arguments or credentials. No shell parsing.
        let output = Command::new("/bin/ps")
            .args(["-axo", "comm=", "-ww"])
            .output()
            .map_err(display)?;
        if !output.status.success() {
            return Err(
                "Could not check whether the existing app is running. It has been kept.".into(),
            );
        }
        let bundle = fs::canonicalize(bundle).map_err(display)?;
        Ok(String::from_utf8_lossy(&output.stdout).lines().any(|line| {
            let executable = Path::new(line.trim());
            executable.starts_with(&bundle)
                || fs::canonicalize(executable).is_ok_and(|path| path.starts_with(&bundle))
        }))
    }

    fn copy_and_verify(source: &Path, staged: &Path, identifier: &str) -> Result<(), String> {
        // ditto preserves resource forks, extended attributes (including quarantine), and ACLs.
        let result = Command::new("/usr/bin/ditto")
            .args(["--rsrc", "--extattr", "--acl"])
            .arg(source)
            .arg(staged)
            .output()
            .map_err(display)?;
        if !result.status.success() {
            return Err(format!(
                "Could not copy the app: {}",
                String::from_utf8_lossy(&result.stderr).trim()
            ));
        }
        if bundle_identifier(staged).as_deref() != Some(identifier) {
            return Err("The copied app's bundle identity did not match.".into());
        }
        let verified = Command::new("/usr/bin/codesign")
            .args(["--verify", "--deep", "--strict"])
            .arg(staged)
            .output()
            .map_err(display)?;
        if !verified.status.success() {
            return Err(format!(
                "The copied app's signature did not verify. The existing app has been kept.\n\n{}",
                String::from_utf8_lossy(&verified.stderr).trim()
            ));
        }
        Ok(())
    }

    fn random_nonce() -> Result<String, String> {
        let mut bytes = [0_u8; 32];
        File::open("/dev/urandom")
            .and_then(|mut file| file.read_exact(&mut bytes))
            .map_err(display)?;
        Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
    }

    fn valid_nonce(value: &str) -> bool {
        value.len() == 64
            && value
                .bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_millis() as u64)
            .unwrap_or(0)
    }

    fn session_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
        let directory = app
            .path()
            .app_local_data_dir()
            .map_err(display)?
            .join("install-sessions");
        if fs::symlink_metadata(&directory).is_ok_and(|metadata| metadata.file_type().is_symlink())
        {
            return Err("The installation session folder is not a regular directory.".into());
        }
        fs::create_dir_all(&directory).map_err(display)?;
        fs::set_permissions(&directory, fs::Permissions::from_mode(0o700)).map_err(display)?;
        Ok(directory)
    }

    fn session_path(directory: &Path, nonce: &str) -> PathBuf {
        directory.join(format!("{nonce}.plist"))
    }
    fn ack_path(directory: &Path, nonce: &str) -> PathBuf {
        directory.join(format!("{nonce}.ack"))
    }
    fn remove_session(directory: &Path, nonce: &str) {
        let _ = fs::remove_file(session_path(directory, nonce));
        let _ = fs::remove_file(ack_path(directory, nonce));
    }

    fn write_session(directory: &Path, session: &InstallSession) -> Result<(), String> {
        let mut dict = Dictionary::new();
        for (key, value) in [
            ("nonce", session.nonce.clone()),
            ("identifier", session.identifier.clone()),
            ("target", session.target.to_string_lossy().into_owned()),
            (
                "image",
                session.mounted.image.to_string_lossy().into_owned(),
            ),
            (
                "mount",
                session.mounted.mount.to_string_lossy().into_owned(),
            ),
            ("diskDevice", session.mounted.device.clone()),
        ] {
            dict.insert(key.into(), Value::String(value));
        }
        for (key, value) in [
            ("parentPid", u64::from(session.parent_pid)),
            ("createdMs", session.created_ms),
            ("fileDevice", session.fingerprint.device),
            ("fileInode", session.fingerprint.inode),
            ("fileLength", session.fingerprint.length),
        ] {
            dict.insert(key.into(), Value::Integer(value.into()));
        }
        dict.insert(
            "modifiedSeconds".into(),
            Value::Integer(session.fingerprint.modified_seconds.into()),
        );
        dict.insert(
            "modifiedNanos".into(),
            Value::Integer(session.fingerprint.modified_nanos.into()),
        );
        dict.insert(
            "cleanupRequested".into(),
            Value::Boolean(session.cleanup_requested),
        );
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(session_path(directory, &session.nonce))
            .map_err(display)?;
        Value::Dictionary(dict).to_writer_xml(file).map_err(display)
    }

    fn read_session(directory: &Path, nonce: &str) -> Result<Option<InstallSession>, String> {
        let path = session_path(directory, nonce);
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            return Ok(None);
        };
        if !metadata.is_file()
            || metadata.file_type().is_symlink()
            || metadata.mode() & 0o077 != 0
            || metadata.len() > 32_768
        {
            return Ok(None);
        }
        let value = Value::from_file(path).map_err(display)?;
        let Some(dict) = value.as_dictionary() else {
            return Ok(None);
        };
        let text = |key| dict.get(key).and_then(Value::as_string).map(str::to_owned);
        let unsigned = |key| dict.get(key).and_then(Value::as_unsigned_integer);
        let signed = |key| dict.get(key).and_then(Value::as_signed_integer);
        let parsed = || {
            Some(InstallSession {
                nonce: text("nonce")?,
                identifier: text("identifier")?,
                target: PathBuf::from(text("target")?),
                mounted: MountedImage {
                    image: PathBuf::from(text("image")?),
                    mount: PathBuf::from(text("mount")?),
                    device: text("diskDevice")?,
                },
                fingerprint: Fingerprint {
                    device: unsigned("fileDevice")?,
                    inode: unsigned("fileInode")?,
                    length: unsigned("fileLength")?,
                    modified_seconds: signed("modifiedSeconds")?,
                    modified_nanos: signed("modifiedNanos")?,
                },
                parent_pid: u32::try_from(unsigned("parentPid")?).ok()?,
                created_ms: unsigned("createdMs")?,
                // Old or malformed markers cannot authorize implicit cleanup.
                cleanup_requested: dict
                    .get("cleanupRequested")
                    .and_then(Value::as_boolean)
                    .unwrap_or(false),
            })
        };
        Ok(parsed().filter(|session| session.nonce == nonce))
    }

    fn valid_session(session: &InstallSession, bundle: &Path, identifier: &str, now: u64) -> bool {
        valid_nonce(&session.nonce)
            && session.identifier == identifier
            && session.target == bundle
            && clean_absolute(&session.target)
            && clean_absolute(&session.mounted.mount)
            && clean_absolute(&session.mounted.image)
            && !bundle.starts_with(&session.mounted.mount)
            && valid_device(&session.mounted.device)
            && session.parent_pid > 1
            && session.parent_pid != std::process::id()
            && now
                .checked_sub(session.created_ms)
                .is_some_and(|age| age < SESSION_LIFETIME_MS)
    }

    fn image_is_unchanged(session: &InstallSession) -> Result<bool, String> {
        Ok(
            fingerprint(&session.mounted.image).ok().as_ref() == Some(&session.fingerprint)
                && mounted_images()?
                    .iter()
                    .any(|image| image == &session.mounted),
        )
    }

    fn parent_is_running(pid: u32) -> Result<bool, String> {
        let status = Command::new("/bin/kill")
            .args(["-0", &pid.to_string()])
            .output()
            .map_err(display)?
            .status;
        Ok(status.success())
    }

    fn display(error: impl std::fmt::Display) -> String {
        error.to_string()
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        fn mounted(image: &str, mount: &str) -> MountedImage {
            MountedImage {
                image: image.into(),
                mount: mount.into(),
                device: "/dev/disk4s2".into(),
            }
        }

        #[test]
        fn only_real_bundle_layouts_are_eligible() {
            assert_eq!(
                bundle_for_executable(Path::new("/Volumes/Example/App.app/Contents/MacOS/app")),
                Some("/Volumes/Example/App.app".into())
            );
            assert!(bundle_for_executable(Path::new("/tmp/target/release/app")).is_none());
            assert!(
                bundle_for_executable(Path::new("/Volumes/Example/Other/Contents/MacOS/app"))
                    .is_none()
            );
            assert!(installer_executable(Path::new(
                "/Volumes/Example/App.app/Contents/MacOS/app"
            )));
            assert!(installer_executable(Path::new(
                "/private/var/folders/example/AppTranslocation/uuid/d/App.app/Contents/MacOS/app"
            )));
            assert!(!installer_executable(Path::new(
                "/Applications/App.app/Contents/MacOS/app"
            )));
            assert!(!installer_executable(Path::new(
                "/tmp/AppTranslocation/target/release/app"
            )));
            assert!(!installer_executable(Path::new(
                "/Volumes-other/App.app/Contents/MacOS/app"
            )));
            assert!(!bundle_needs_installation(Path::new(
                "/Applications/Example.app"
            )));
            assert!(!bundle_needs_installation(Path::new(
                "/Users/test/Applications/Example.app"
            )));
        }

        #[test]
        fn one_consent_discloses_install_destination_and_recoverable_cleanup() {
            let target = Path::new("/Applications/Example.app");
            let image = Path::new("/Users/test/Downloads/exact-installer.dmg");
            let fresh = installation_message("Example", target, image, false);
            assert!(fresh.contains("Install Example in /Applications and open it?"));
            assert!(fresh.contains("After it opens"));
            assert!(fresh.contains("eject the installer disk"));
            assert!(fresh.contains("move this installer to Trash"));
            assert!(fresh.contains("/Users/test/Downloads/exact-installer.dmg"));
            let replacement = installation_message("Example", target, image, true);
            assert!(replacement.contains("Replace Example in /Applications and open it?"));
            assert!(
                replacement.contains("previous app goes to Trash after the new copy is verified")
            );
        }

        #[test]
        fn replacement_requires_same_identity_and_rejects_unrelated_files_or_links() {
            let directory = std::env::temp_dir().join(format!(
                "cinematic-replace-test-{}",
                random_nonce().unwrap()
            ));
            let bundle = directory.join("Example.app");
            fs::create_dir_all(bundle.join("Contents")).unwrap();
            let mut info = Dictionary::new();
            info.insert(
                "CFBundleIdentifier".into(),
                Value::String("app.cinematic.example".into()),
            );
            Value::Dictionary(info)
                .to_file_xml(bundle.join("Contents/Info.plist"))
                .unwrap();
            assert!(validate_existing_bundle(&bundle, "app.cinematic.example").is_ok());
            assert!(validate_existing_bundle(&bundle, "app.unrelated.example").is_err());
            let file = directory.join("Other.app");
            fs::write(&file, "unrelated user file").unwrap();
            assert!(validate_existing_bundle(&file, "app.cinematic.example").is_err());
            assert_eq!(fs::read_to_string(&file).unwrap(), "unrelated user file");
            let link = directory.join("Linked.app");
            std::os::unix::fs::symlink(&bundle, &link).unwrap();
            assert!(validate_existing_bundle(&link, "app.cinematic.example").is_err());
            fs::remove_dir_all(directory).unwrap();
        }

        fn identity() -> SignedIdentity {
            SignedIdentity {
                identifier: "app.cinematic.example".into(),
                version: "0.3.0".into(),
                short_version: "0.3.0".into(),
                cd_hash: "a".repeat(40),
            }
        }

        #[test]
        fn translocation_recovery_requires_one_exact_signed_version() {
            let exact = identity();
            let disk = mounted("/Users/test/Downloads/app.dmg", "/Volumes/App");
            let source = PathBuf::from("/Volumes/App/Example.app");
            let mut other_version = exact.clone();
            other_version.version = "0.2.0".into();
            let mut other_signature = exact.clone();
            other_signature.cd_hash = "b".repeat(40);
            let mut other_identifier = exact.clone();
            other_identifier.identifier = "app.other.example".into();
            assert!(unique_signed_source(
                &exact,
                vec![(source.clone(), disk.clone(), other_version.clone())]
            )
            .is_none());
            assert!(unique_signed_source(
                &exact,
                vec![(source.clone(), disk.clone(), other_signature)]
            )
            .is_none());
            assert!(unique_signed_source(
                &exact,
                vec![(source.clone(), disk.clone(), other_identifier)]
            )
            .is_none());
            assert_eq!(
                unique_signed_source(
                    &exact,
                    vec![
                        (source.clone(), disk.clone(), other_version),
                        (source.clone(), disk.clone(), exact.clone())
                    ]
                ),
                Some((source.clone(), disk.clone()))
            );
            assert!(unique_signed_source(
                &exact,
                vec![
                    (source.clone(), disk.clone(), exact.clone()),
                    (source, disk, exact.clone())
                ]
            )
            .is_none());
        }

        #[test]
        fn code_signature_hash_parser_rejects_missing_malformed_or_ambiguous_hashes() {
            let hash = "AB".repeat(20);
            assert_eq!(
                cd_hash_from_output(&format!(
                    "Executable=/Volumes/App/Example.app\nCDHash={hash}\nSignature=adhoc\n"
                )),
                Some(hash.to_ascii_lowercase())
            );
            assert!(cd_hash_from_output("Signature=adhoc\n").is_none());
            assert!(cd_hash_from_output("CDHash=../../app\n").is_none());
            assert!(cd_hash_from_output(&format!("CDHash={hash}\nCDHash={hash}\n")).is_none());
        }

        #[test]
        fn mount_matching_uses_components_and_rejects_ambiguity() {
            let image = mounted("/Users/test/Downloads/app.dmg", "/Volumes/App");
            assert_eq!(
                image_containing_bundle(
                    std::slice::from_ref(&image),
                    Path::new("/Volumes/App/Example.app")
                ),
                Some(image.clone())
            );
            assert!(image_containing_bundle(
                std::slice::from_ref(&image),
                Path::new("/Volumes/App-other/Example.app")
            )
            .is_none());
            assert!(image_containing_bundle(
                std::slice::from_ref(&image),
                Path::new("/Applications/Example.app")
            )
            .is_none());
            assert!(image_containing_bundle(
                &[image.clone(), image],
                Path::new("/Volumes/App/Example.app")
            )
            .is_none());
        }

        #[test]
        fn malformed_mount_records_do_not_authorize_installer_cleanup() {
            let xml = br#"<?xml version="1.0"?><plist version="1.0"><dict><key>images</key><array>
                <dict><key>image-path</key><string>/Users/test/app.dmg</string><key>system-entities</key><array><dict><key>mount-point</key><string>/Volumes/App</string><key>dev-entry</key><string>/dev/disk4s2</string></dict></array></dict>
                <dict><key>image-path</key><string>relative.dmg</string><key>system-entities</key><array><dict><key>mount-point</key><string>/Volumes/Bad</string><key>dev-entry</key><string>/dev/disk5</string></dict></array></dict>
                <dict><key>image-path</key><string>/Users/test/bad.dmg</string><key>system-entities</key><array><dict><key>mount-point</key><string>/</string><key>dev-entry</key><string>/dev/disk5;bad</string></dict></array></dict>
                </array></dict></plist>"#;
            assert_eq!(
                images_from_plist(&Value::from_reader(Cursor::new(xml)).unwrap()),
                vec![mounted("/Users/test/app.dmg", "/Volumes/App")]
            );
            assert!(!clean_absolute(Path::new("/Volumes/App/../Other")));
            assert!(!valid_device("/dev/disk4\n"));
        }

        fn session() -> InstallSession {
            InstallSession {
                nonce: "a".repeat(64),
                identifier: "app.cinematic.example".into(),
                target: "/Applications/Example.app".into(),
                mounted: mounted("/Users/test/Downloads/app.dmg", "/Volumes/App"),
                fingerprint: Fingerprint {
                    device: 1,
                    inode: 2,
                    length: 3,
                    modified_seconds: 4,
                    modified_nanos: 5,
                },
                parent_pid: std::process::id() + 100,
                created_ms: 1_000,
                cleanup_requested: true,
            }
        }

        #[test]
        fn cleanup_requires_exact_installed_child_identity_and_fresh_session() {
            let mut session = session();
            assert!(valid_session(
                &session,
                Path::new("/Applications/Example.app"),
                "app.cinematic.example",
                1_001
            ));
            assert!(!valid_session(
                &session,
                Path::new("/Applications/Other.app"),
                "app.cinematic.example",
                1_001
            ));
            assert!(!valid_session(
                &session,
                Path::new("/Applications/Example.app"),
                "other.identifier",
                1_001
            ));
            assert!(!valid_session(
                &session,
                &session.target,
                &session.identifier,
                999
            ));
            assert!(!valid_session(
                &session,
                &session.target,
                &session.identifier,
                1_000 + SESSION_LIFETIME_MS
            ));
            session.parent_pid = std::process::id();
            assert!(!valid_session(
                &session,
                &session.target,
                &session.identifier,
                1_001
            ));
            assert!(!valid_nonce("../../some-file"));
        }

        #[test]
        fn private_marker_round_trip_and_public_or_symlink_marker_rejection() {
            let directory = std::env::temp_dir().join(format!(
                "cinematic-install-test-{}",
                random_nonce().unwrap()
            ));
            fs::create_dir(&directory).unwrap();
            let session = session();
            write_session(&directory, &session).unwrap();
            let loaded = read_session(&directory, &session.nonce).unwrap().unwrap();
            assert_eq!(loaded.target, session.target);
            assert_eq!(loaded.mounted, session.mounted);
            assert_eq!(loaded.fingerprint, session.fingerprint);
            assert_eq!(loaded.parent_pid, session.parent_pid);
            assert!(loaded.cleanup_requested);
            let path = session_path(&directory, &session.nonce);
            let mut value = Value::from_file(&path).unwrap();
            value
                .as_dictionary_mut()
                .unwrap()
                .remove("cleanupRequested");
            value.to_file_xml(&path).unwrap();
            assert!(
                !read_session(&directory, &session.nonce)
                    .unwrap()
                    .unwrap()
                    .cleanup_requested
            );
            value
                .as_dictionary_mut()
                .unwrap()
                .insert("cleanupRequested".into(), Value::String("true".into()));
            value.to_file_xml(&path).unwrap();
            assert!(
                !read_session(&directory, &session.nonce)
                    .unwrap()
                    .unwrap()
                    .cleanup_requested
            );
            value
                .as_dictionary_mut()
                .unwrap()
                .insert("cleanupRequested".into(), Value::Boolean(false));
            value.to_file_xml(&path).unwrap();
            assert!(
                !read_session(&directory, &session.nonce)
                    .unwrap()
                    .unwrap()
                    .cleanup_requested
            );
            fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
            assert!(read_session(&directory, &session.nonce).unwrap().is_none());
            fs::remove_file(&path).unwrap();
            std::os::unix::fs::symlink("/does-not-exist", &path).unwrap();
            assert!(read_session(&directory, &session.nonce).unwrap().is_none());
            fs::remove_dir_all(directory).unwrap();
        }
    }
}
