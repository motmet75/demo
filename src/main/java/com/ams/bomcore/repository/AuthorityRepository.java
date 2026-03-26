package com.ams.bomcore.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.user.Authority;

@Repository
public interface AuthorityRepository extends JpaRepository<Authority, Integer> {
    List<Authority> findByUsername(String username);
    void deleteByUsername(String username);
}
