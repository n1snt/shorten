From requirements:
- 1B shortened URLs
- 100M dau
- < 100ms for all the APIs

That will affect:
- How many chars for the short code
- How much RPS it needs to handle for 100M DAU

SHA-256 has 0-9 and a-f (16 chars)
So
meanwhile with 16^6 it will be 16.7 million.
meanwhile with 16^7 it will be 260 million.
16^8 possiblities if we choose 8 chars for short code (approx 4 billion)

Therefore atleast 8 chars.

---

100M DAU that means:

Let's assume a user has atleast 5 requests a day
So in 1 day = 100M * 5 / 24 
In 1 hour  = 2^7
In 1 minute = 2^7/60 = 347k
In 1 second = 6k (approx)
