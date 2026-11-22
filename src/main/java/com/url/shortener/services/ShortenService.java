package com.url.shortener.services;

import com.url.shortener.models.Shorten;
import com.url.shortener.respository.ShortenRepository;
import com.url.shortener.utils.ShortCodeGenerator;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class ShortenService {
    private final ShortenRepository shortenRepository;

    public ShortenService(ShortenRepository shortenRepository) {
        this.shortenRepository = shortenRepository;
    }

    public Shorten addShortUrl(Shorten input) throws DuplicateKeyException, IllegalStateException {
        int maxRetries = 5;
        boolean userSuppliedCode = input.getShortCode() != null;

        for (int i = 0; i < maxRetries; i++) {
            if (!userSuppliedCode) {
                input.setShortCode(
                        ShortCodeGenerator.generate(input.getOriginalUrl())
                );
            }
            try {
                return shortenRepository.addShortUrl(input);
            } catch (DuplicateKeyException e) {
                if (userSuppliedCode || i == maxRetries - 1) {
                    throw e;
                }
            }
        }

        throw new IllegalStateException("Unexpected execution");
    }

    public boolean deleteShortUrl(String shortCode) {
        int deleted = shortenRepository.deleteShortUrl(shortCode);
        return deleted > 0;
    }

    public Shorten updateShortUrl(String existingShortCode, Shorten input) {
        return shortenRepository.updateShortUrl(existingShortCode, input);
    }

    @Cacheable(value = "short_codes", key="#shortCode")
    public String shortUrlByCode(String shortCode) {
        Optional<String> shorten = shortenRepository.getShortUrlByShortCode(shortCode);
        return shorten.orElse(null);
    }
}
