package com.url.shortener.controllers;

import com.url.shortener.constants.Resource;
import com.url.shortener.exceptions.variants.ResourceNotFoundException;
import com.url.shortener.models.Shorten;
import com.url.shortener.services.ShortenService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/")
public class RedirectController {

    private final ShortenService shortenService;
    private final String resource = Resource.USER;

    public RedirectController(ShortenService shortenService) {
        this.shortenService = shortenService;
    }

    @GetMapping("/{short_code}")
    private ResponseEntity<Void> get(@PathVariable String short_code) throws ResourceNotFoundException {
        String originalUrl = shortenService.shortUrlByCode(short_code);
        if (originalUrl == null) {
            throw new ResourceNotFoundException(resource);
        }
        return ResponseEntity.status(HttpStatus.FOUND).header("Location", originalUrl).build();
    }
}
