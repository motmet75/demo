package com.ams.bomcore.audit;

import javax.sql.DataSource;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AuditDataSourceConfiguration {
    @Bean public static BeanPostProcessor auditDataSourcePostProcessor() {
        return new BeanPostProcessor() {
            @Override public Object postProcessAfterInitialization(Object bean, String name) {
                return bean instanceof DataSource source && !(bean instanceof AuditDataSource) ? new AuditDataSource(source) : bean;
            }
        };
    }
}
