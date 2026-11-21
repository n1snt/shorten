package com.url.shortener.models;

import java.sql.Date;

public class ShortenResponse {
    String originalUrl;
    String shortCode;
    Date expiry;

    public ShortenResponse(String originalUrl, String shortCode, Date expiry) {
        this.originalUrl = originalUrl;
        this.shortCode = shortCode;
        this.expiry = expiry;
    }

    public String getOriginalUrl() {
        return originalUrl;
    }

    public String getShortCode() {
        return shortCode;
    }

    public Date getExpiry() {
        return expiry;
    }
}
