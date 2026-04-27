package com.remotefalcon.external.api.controller;

import com.remotefalcon.external.api.aop.RequiresAccess;
import com.remotefalcon.external.api.request.RequestVoteRequest;
import com.remotefalcon.external.api.response.RequestVoteResponse;
import com.remotefalcon.external.api.response.ShowResponse;
import com.remotefalcon.external.api.service.ExternalApiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class ExternalApiController {
  private final ExternalApiService externalApiService;

  @GetMapping(value = "/showDetails")
  @RequiresAccess
  public ResponseEntity<ShowResponse> showDetails() {
    return this.externalApiService.showDetails();
  }

  @PostMapping(value = "/addSequenceToQueue")
  @RequiresAccess
  public ResponseEntity<RequestVoteResponse> addSequenceToQueue(@RequestBody RequestVoteRequest requestVoteRequest) {
    return this.externalApiService.addSequenceToQueue(requestVoteRequest);
  }

  @PostMapping(value = "/voteForSequence")
  @RequiresAccess
  public ResponseEntity<RequestVoteResponse> voteForSequence(@RequestBody RequestVoteRequest requestVoteRequest) {
    return this.externalApiService.voteForSequence(requestVoteRequest);
  }
}
