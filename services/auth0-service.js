const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const {
  AUTH0_DOMAIN,
  AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET,
  AUTH0_AUDIENCE
} = process.env

if (!AUTH0_DOMAIN) throw new Error("AUTH0_DOMAIN isn't defined")
if (!AUTH0_CLIENT_ID) throw new Error("AUTH0_CLIENT_ID isn't defined")
if (!AUTH0_CLIENT_SECRET) throw new Error("AUTH0_CLIENT_SECRET isn't defined")
if (!AUTH0_AUDIENCE) throw new Error("AUTH0_AUDIENCE isn't defined")

/**
 * Authorization middleware. When used, the
 * Access Token must exist and be verified against
 * the Auth0 JSON Web Key Set.
 * The middleware doesn't check if the token has the sufficient scope to access
 * the requested resources!
 */
exports.checkJwt = jwt({
  // Dynamically provide a signing key
  // based on the kid in the header and
  // the signing keys provided by the JWKS endpoint.
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer.
  aud: AUTH0_AUDIENCE,
  issuer: [`https://${AUTH0_DOMAIN}/`],
  algorithms: ['RS256'],
});