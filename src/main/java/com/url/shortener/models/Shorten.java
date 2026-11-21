package com.url.shortener.models;

import java.sql.Date;

public class Shorten {
    String originalUrl;
    String shortCode;
    Date expiry;
    Date createdAt;

    public Shorten() {}

    public Shorten(String originalUrl, String shortCode, Date expiry, Date createdAt) {
        this.originalUrl = originalUrl;
        this.shortCode = shortCode;
        this.expiry = expiry;
        this.createdAt = createdAt;
    }

    public Shorten(String originalUrl, String shortCode, Date expiry) {
        this.originalUrl = originalUrl;
        this.shortCode = shortCode;
        this.expiry = expiry;
    }

    public String getShortCode() {
        return shortCode;
    }

    public void setShortCode(String shortCode) {
        this.shortCode = shortCode;
    }

    public String getOriginalUrl() {
        return originalUrl;
    }

    public Date getExpiry() {
        return expiry;
    }

    public ShortenResponse toResponse() {
        return new ShortenResponse(
                this.originalUrl,
                this.shortCode,
                this.expiry
        );
    }
}
