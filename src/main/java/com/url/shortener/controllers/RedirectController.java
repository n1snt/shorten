package com.url.shortener.controllers;

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

    public RedirectController(ShortenService shortenService) {
        this.shortenService = shortenService;
    }

    @GetMapping("/{short_code}")
    private ResponseEntity<Void> get(@PathVariable String short_code) {
        Shorten shorten = shortenService.shortUrlByCode(short_code);
        return ResponseEntity.status(HttpStatus.FOUND).header("Location", shorten.getOriginalUrl()).build();
    }
}
