package com.url.shortener.services;

import com.url.shortener.models.Shorten;
import com.url.shortener.respository.ShortenRepository;
import com.url.shortener.utils.ShortCodeGenerator;
import org.springframework.stereotype.Service;

@Service
public class ShortenService {
    private final ShortenRepository shortenRepository;

    public ShortenService(ShortenRepository shortenRepository) {
        this.shortenRepository = shortenRepository;
    }

    public Shorten addShortUrl(Shorten input) {
        if (input.getShortCode() == null) {
            input.setShortCode(ShortCodeGenerator.generate(input.getOriginalUrl()));
        }
        return shortenRepository.addShortUrl(input).get();
    }

    public void deleteShortUrl(String shortCode) {
        shortenRepository.deleteShortUrl(shortCode);
    }

    public Shorten updateShortUrl(Shorten input) {
        return shortenRepository.updateShortUrl(input).get();
    }

    public Shorten shortUrlByCode(String shortCode) {
        return shortenRepository.getShortUrlByShortCode(shortCode).get();
    }


}
