package com.ams.bomcore.repository;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.ams.bomcore.domain.service.ServiceBomItem;
public interface ServiceBomItemRepository extends JpaRepository<ServiceBomItem, UUID> {
    List<ServiceBomItem> findAllByServiceBomIdOrderByCostType(UUID serviceBomId);
}
