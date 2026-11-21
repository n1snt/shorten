package com.url.shortener.respository;

import com.url.shortener.models.Shorten;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class ShortenRepository {

    private final JdbcClient jdbcClient;

    public ShortenRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<Shorten> addShortUrl(Shorten input) {
        return jdbcClient.sql("""
                INSERT INTO short_urls (short_code, original_url, expiry)
                VALUES (:shortCode, :originalUrl, COALESCE(:expiry, now() + interval '1 day'))
                RETURNING original_url AS originalUrl, short_code AS shortCode, expiry AS expiry;
                """)
                .param("shortCode", input.getShortCode())
                .param("originalUrl", input.getOriginalUrl())
                .param("expiry", input.getExpiry())
                .query(Shorten.class)
                .optional();
    }

    public void deleteShortUrl(String shortCode) {
        jdbcClient.sql("""
                DELETE FROM short_urls WHERE short_code = :shortCode;
                """)
                .param("shortCode", shortCode);
    }

    public Optional<Shorten> updateShortUrl(Shorten input) {
        return jdbcClient.sql("""
                UPDATE short_urls SET
                    short_code = COALESCE(:shortCode, shortCode),
                    expiry = COALESCE(:expiry, expiry),
                WHERE short_code = :shortCode
                RETURNING original_url AS originalUrl, short_code AS shortCode, expiry AS expiry;
                """)
                .param("shortCode", input.getShortCode())
                .param("expiry", input.getExpiry())
                .query(Shorten.class)
                .optional();
    }

    public Optional<Shorten> getShortUrlByShortCode(String shortCode) {
        return jdbcClient.sql("""
                SELECT original_url, expiry FROM short_urls WHERE short_code = :shortCode;
                """)
                .param("shortCode", shortCode)
                .query(Shorten.class)
                .optional();
    }
}
