package com.courseregistration.dto;

public record ChatResponse(String reply, boolean aiPowered, String mode, java.util.List<String> sources, java.util.List<String> suggestions) {}
