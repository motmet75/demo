package com.anhmedia.portalweb.legacy;

import jakarta.persistence.Column;
import org.springframework.jdbc.core.RowMapper;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Hydrates the unchanged legacy entity classes like Hibernate's field access
 * (@Access(FIELD)): the no-arg constructor runs (field defaults), then every
 * @Column field is assigned straight from its column, NULLs included,
 * bypassing setters. Legacy Hibernate used no naming strategy, so an unquoted
 * camelCase column name became lower case in PostgreSQL.
 */
public final class LegacyRowMapper<T> implements RowMapper<T> {
    private static final Map<Class<?>, LegacyRowMapper<?>> CACHE = new ConcurrentHashMap<>();

    private final Class<T> type;
    private final Constructor<T> constructor;
    private final List<Binding> bindings;
    private final Binding idBinding;

    private record Binding(Field field, String column) {}

    @SuppressWarnings("unchecked")
    public static <T> LegacyRowMapper<T> of(Class<T> type) {
        return (LegacyRowMapper<T>) CACHE.computeIfAbsent(type, LegacyRowMapper::new);
    }

    private LegacyRowMapper(Class<T> type) {
        this.type = type;
        try {
            this.constructor = type.getDeclaredConstructor();
            this.constructor.setAccessible(true);
        } catch (NoSuchMethodException e) {
            throw new IllegalArgumentException(type + " has no no-arg constructor", e);
        }
        List<Binding> list = new ArrayList<>();
        for (Class<?> c = type; c != null && c != Object.class; c = c.getSuperclass()) {
            for (Field f : c.getDeclaredFields()) {
                Column column = f.getAnnotation(Column.class);
                if (column == null || Modifier.isStatic(f.getModifiers())) continue;
                String name = column.name().isEmpty() ? f.getName() : column.name();
                f.setAccessible(true);
                list.add(new Binding(f, name.toLowerCase(Locale.ROOT)));
            }
        }
        this.bindings = List.copyOf(list);
        this.idBinding = list.stream().filter(b -> b.field().isAnnotationPresent(jakarta.persistence.Id.class))
                .findFirst().orElse(null);
    }

    @Override
    public T mapRow(ResultSet rs, int rowNum) throws SQLException {
        if (idBinding == null) return hydrate(rs);
        Object id = convert(rs.getObject(idBinding.column()), idBinding.field().getType());
        return PersistenceContext.managed(type, id, () -> hydrate(rs));
    }

    private T hydrate(ResultSet rs) throws SQLException {
        Set<String> present = columns(rs);
        try {
            T entity = constructor.newInstance();
            for (Binding b : bindings) {
                if (!present.contains(b.column())) continue; // column missing in an older tenant schema
                Object value = convert(rs.getObject(b.column()), b.field().getType());
                if (value == null && b.field().getType().isPrimitive()) continue;
                b.field().set(entity, value);
            }
            return entity;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Cannot hydrate " + constructor.getDeclaringClass().getSimpleName(), e);
        }
    }

    private static Set<String> columns(ResultSet rs) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        Set<String> names = new HashSet<>();
        for (int i = 1; i <= meta.getColumnCount(); i++) names.add(meta.getColumnLabel(i).toLowerCase(Locale.ROOT));
        return names;
    }

    static Object convert(Object value, Class<?> target) {
        if (value == null) return null;
        if (target.isInstance(value)) return value;
        if (target == String.class) return value.toString();
        if (value instanceof Number n) {
            if (target == Long.class || target == long.class) return n.longValue();
            if (target == Integer.class || target == int.class) return n.intValue();
            if (target == Double.class || target == double.class) return n.doubleValue();
            if (target == Float.class || target == float.class) return n.floatValue();
            if (target == Short.class || target == short.class) return n.shortValue();
            if (target == BigDecimal.class) return new BigDecimal(n.toString());
            if (target == Boolean.class || target == boolean.class) return n.intValue() != 0;
        }
        if (value instanceof Timestamp t) {
            if (target == LocalDateTime.class) return t.toLocalDateTime();
            if (target == LocalDate.class) return t.toLocalDateTime().toLocalDate();
        }
        if (value instanceof java.sql.Date d && target == LocalDate.class) return d.toLocalDate();
        if (value instanceof Boolean b && (target == boolean.class)) return b;
        if (value instanceof String s) {
            if (target == BigDecimal.class) return new BigDecimal(s.trim());
            if (target == Long.class || target == long.class) return Long.valueOf(s.trim());
            if (target == Integer.class || target == int.class) return Integer.valueOf(s.trim());
            if (target == Boolean.class || target == boolean.class) return Boolean.valueOf(s.trim());
        }
        throw new IllegalArgumentException("Cannot convert " + value.getClass().getSimpleName() + " to " + target.getSimpleName());
    }
}
