package com.url.shortener.utils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

public class ShortCodeGenerator {

    /**
     * Shortens the long URL by hashing it & returning only the first 8 characters
     * @param longUrl the long url from request
     * @return 8 character short url
     */
    public static String generate(String longUrl) {
        try {
            String timestampURL = longUrl + UUID.randomUUID();
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            byte[] encodeHash = messageDigest.digest(timestampURL.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(encodeHash).substring(0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
