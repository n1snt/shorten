package com.url.shortener.controllers;

import com.url.shortener.constants.Resource;
import com.url.shortener.models.Shorten;
import com.url.shortener.models.ShortenRequest;
import com.url.shortener.models.ShortenResponse;
import com.url.shortener.services.ShortenService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/shorten")
public class ShortenController {

    private final ShortenService shortenService;
    private final String resource = Resource.USER;

    public ShortenController(ShortenService shortenService) {
        this.shortenService = shortenService;
    }

    @PostMapping
    private ResponseEntity<ShortenResponse> post(@RequestBody ShortenRequest requestBody) {
        Shorten shorten = shortenService.addShortUrl(requestBody.toShorten());
        return ResponseEntity.status(HttpStatus.CREATED).body(shorten.toResponse());
    }

    @DeleteMapping("/{shortCode}")
    private ResponseEntity<Void> delete(@PathVariable String shortCode) {
        boolean deleted =  shortenService.deleteShortUrl(shortCode);
        if (deleted) {
            return ResponseEntity.status(HttpStatus.OK).build();
        }
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
    }

    @PatchMapping("/{shortCode}")
    private ResponseEntity<ShortenResponse> patch(@RequestBody ShortenRequest requestBody, @PathVariable String shortCode) {
        Shorten shorten = shortenService.updateShortUrl(shortCode, requestBody.toShorten());
        return ResponseEntity.status(HttpStatus.OK).body(shorten.toResponse());
    }
}
