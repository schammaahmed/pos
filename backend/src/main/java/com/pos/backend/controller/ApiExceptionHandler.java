package com.pos.backend.controller;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

// One place that turns exceptions into clean JSON errors for ALL controllers.
// (ResponseStatusException already produces good responses on its own - not handled here.)
@RestControllerAdvice
public class ApiExceptionHandler {

    // @Valid failures: instead of a generic 400, tell the frontend WHICH field is wrong
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fields = e.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        fieldError -> fieldError.getField(),
                        fieldError -> fieldError.getDefaultMessage() == null ? "invalid" : fieldError.getDefaultMessage(),
                        (first, second) -> first)); // if a field has several errors, keep the first
        return Map.of("message", "Validation failed", "fields", fields);
    }

    // a concurrent update slipped past the retries - the seller just presses the button again
    @ExceptionHandler(OptimisticLockingFailureException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, Object> handleOptimisticLock(OptimisticLockingFailureException e) {
        return Map.of("message", "Someone else changed this data at the same time - please try again");
    }
}
