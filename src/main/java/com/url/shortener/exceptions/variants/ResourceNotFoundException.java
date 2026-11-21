package com.url.shortener.exceptions.variants;

public class ResourceNotFoundException extends Exception {

    public ResourceNotFoundException(String res) {
        super(res + " not found!");
    }
}
