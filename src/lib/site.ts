// Links inside emails must open on the live site, even when the email was triggered from local dev
// (localhost links are useless to the person receiving them). EMAIL_LINK_BASE overrides for staging.
export function emailBase(){
 const u=(process.env.EMAIL_LINK_BASE||process.env.NEXT_PUBLIC_SITE_URL||'').trim().replace(/\/$/,'');
 return u&&/^https:\/\//.test(u)&&!/localhost|127\.0\.0\.1/.test(u)?u:'https://zaane.co';
}
