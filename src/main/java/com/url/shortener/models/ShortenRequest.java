package com.url.shortener.models;

import java.sql.Date;

public class ShortenRequest {
    String originalUrl;
    String shortCode;
    Date expiry;

    public String getOriginalUrl() {
        return originalUrl;
    }

    public void setOriginalUrl(String originalUrl) {
        this.originalUrl = originalUrl;
    }

    public String getShortCode() {
        return shortCode;
    }

    public void setShortCode(String shortCode) {
        this.shortCode = shortCode;
    }

    public Date getExpiry() {
        return expiry;
    }

    public void setExpiry(Date expiry) {
        this.expiry = expiry;
    }

    public ShortenRequest() {};

    public Shorten toShorten() {
        return new Shorten(this.originalUrl, this.shortCode, this.expiry);
    }
}
