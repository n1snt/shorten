package com.url.shortener.respository;

import com.url.shortener.models.Shorten;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class ShortenRepository {

    private final JdbcClient jdbcClient;

    public ShortenRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Shorten addShortUrl(Shorten input) throws DuplicateKeyException {
        try {
            return jdbcClient.sql("""
                INSERT INTO short_urls (short_code, original_url, expiry)
                VALUES (:shortCode, :originalUrl, COALESCE(:expiry, now() + interval '1 day'))
                RETURNING original_url AS originalUrl, short_code AS shortCode, expiry AS expiry;
                """)
                    .param("shortCode", input.getShortCode())
                    .param("originalUrl", input.getOriginalUrl())
                    .param("expiry", input.getExpiry())
                    .query(Shorten.class)
                    .single();
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw new DuplicateKeyException(e.getMessage());
        }
    }

    public int deleteShortUrl(String shortCode) {
        return jdbcClient.sql("""
                DELETE FROM short_urls WHERE short_code = :shortCode;
                """)
                .param("shortCode", shortCode)
                .update();
    }

    public Shorten updateShortUrl(String existingShortCode, Shorten input) {
        return jdbcClient.sql("""
                UPDATE short_urls SET
                    short_code = COALESCE(:shortCode, short_code),
                    expiry = COALESCE(:expiry, expiry)
                WHERE short_code = :existingShortCode
                RETURNING original_url AS originalUrl, short_code AS shortCode, expiry AS expiry;
                """)
                .param("existingShortCode", existingShortCode)
                .param("shortCode", input.getShortCode())
                .param("expiry", input.getExpiry())
                .query(Shorten.class)
                .single();
    }

    public Optional<String> getShortUrlByShortCode(String shortCode) {
        return jdbcClient.sql("""
                SELECT original_url FROM short_urls 
                WHERE short_code = :shortCode AND expiry > now();
                """)
                .param("shortCode", shortCode)
                .query(String.class)
                .optional();
    }
}
