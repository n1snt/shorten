This is a project to practice system design by recreating bit.ly url shortning service.

Functional requirements:
- Submit long url get a short one
- Specify expiration date
- Access original resource using the shortened URL
- custom alias for it

Out of scope for V1:
- No authentication
- No analytics or anything

Non functional requirements:
- All short url codes should be unique
- Minimal delay (less than 100ms)
- Redirection in less than 100ms
- reliable & available 99.99% times
- Handle 1B shortened URLs & 100M DAU

Core entities:
- Original URL
- Short URL

API:
- POST /api/shorten -> Create the short URL
{
  "original_url": "www.google.com",
  "custom_alias": "hello",
  "expiry: "tz timestamp here"
}

- GET /{code} -> Redirects the user to the resource using 302
  Headers will have:
  * 302 Found 
  * Location: original_url

- DELETE /api/shorten/{code} -> Delete the redirect

- PATCH /api/shorten -> update the expiry date or change custom alias
{
  "short_code": "",
  "alias": "new_alias",
  "expiry": "new_expiry"
}
