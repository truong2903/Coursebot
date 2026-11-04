package com.courseregistration.service.chat;

/**
 * GoF Adapter Pattern: Chuẩn hóa giao diện kết nối nhiều nguồn AI Chatbot khác nhau
 * (OpenAI-compatible API như Gemini/Groq/Ollama hoặc Microservice Chatbot riêng của thành viên trong nhóm).
 */
public interface AiProviderAdapter {
    String providerName();
    boolean isConfigured();
    String generateExplanation(AiChatExchange exchange);
}
