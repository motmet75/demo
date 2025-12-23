FROM eclipse-temurin:19-jdk

WORKDIR /opt/tuonghoa/demo

COPY target/*.jar app.jar

# Copy đúng vị trí Java đang tìm

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
