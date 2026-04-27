package com.remotefalcon.external.api.repository;

import com.remotefalcon.library.documents.Show;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ShowRepository extends MongoRepository<Show, String> {
    Optional<Show> findByShowToken(String showToken);
    Optional<Show> findByApiAccessApiAccessToken(String apiAccessToken);
}
