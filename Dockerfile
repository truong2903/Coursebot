# Stage 1: Build with Maven & Java 21
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app

# Use Google Cloud Maven Central mirror to avoid HTTP 429 rate limits on shared cloud builders (e.g. Render)
COPY .mvn/maven-mirror-settings.xml /root/.m2/settings.xml
COPY pom.xml ./
RUN mvn -B -ntp dependency:go-offline || true

COPY src ./src
RUN mvn -B -ntp clean package -DskipTests

# Stage 2: Minimal runtime image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/coursebot-*.jar app.jar

ENV PORT=8080
ENV TZ=Asia/Ho_Chi_Minh
EXPOSE 8080

ENTRYPOINT ["java", "-Duser.timezone=Asia/Ho_Chi_Minh", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
