const names = ['APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY', 'APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID']
const configured = names.filter(name => Boolean(process.env[name]))
if (configured.length && configured.length !== names.length) {
  throw new Error(`Apple signing setup is incomplete. Configure these secret names: ${names.filter(name => !process.env[name]).join(', ')}. No secret values are printed.`)
}
if (process.env.APPLE_SIGNING_IDENTITY === '-') throw new Error('A notarized release needs a Developer ID Application identity, not an ad-hoc identity.')
console.log(configured.length ? 'Apple signing and notarization credentials are configured; the build must complete both steps.' : 'No Apple signing credentials configured. Building ad-hoc signed; not notarized. macOS approval will be required.')
