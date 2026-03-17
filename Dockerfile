FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app

# Install maven
RUN apk add --no-cache maven

# ── LAYER 1: Copy pom.xml ONLY ──────────────────────
# This layer is cached unless pom.xml changes
COPY pom.xml .

# Download all dependencies into local cache
RUN mvn dependency:go-offline -B

# ── LAYER 2: Copy source code ────────────────────────
# This layer rebuilds when ANY source file changes
# But skips downloading deps (already cached above)
COPY src ./src

# Build jar
RUN mvn clean package -DskipTests -o

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
