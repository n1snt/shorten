package com.url.shortener.exceptions;

import com.url.shortener.exceptions.variants.ResourceNotFoundException;
import com.url.shortener.models.ErrorResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException exception) {
        ErrorResponse response = new ErrorResponse();
        response.setMessage(exception.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateKey(DuplicateKeyException exception) {
        ErrorResponse response = new ErrorResponse();
        response.setMessage(exception.getLocalizedMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }
}
