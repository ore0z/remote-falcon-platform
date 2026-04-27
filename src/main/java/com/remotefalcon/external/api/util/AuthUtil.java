package com.remotefalcon.external.api.util;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.remotefalcon.external.api.repository.ShowRepository;
import com.remotefalcon.library.documents.Show;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuthUtil {
  private final ShowRepository showRepository;
  public String showToken;

  public Boolean isApiJwtValid(HttpServletRequest httpServletRequest) throws JWTVerificationException {
    try {
      String token = this.getTokenFromRequest(httpServletRequest);
      if (StringUtils.isEmpty(token)) {
        return false;
      }
      DecodedJWT decodedJWT = JWT.decode(token);
      String accessToken = decodedJWT.getClaims().get("accessToken").asString();
      Optional<Show> show = this.showRepository.findByApiAccessApiAccessToken(accessToken);
      if(show.isEmpty()) {
        return false;
      }
      Algorithm algorithm = Algorithm.HMAC256(show.get().getApiAccess().getApiAccessSecret());
      JWTVerifier verifier = JWT.require(algorithm).build();
      verifier.verify(token);
      this.showToken = show.get().getShowToken();
      return true;
    } catch (JWTVerificationException e) {
      return false;
    }
  }

  public String getTokenFromRequest(HttpServletRequest httpServletRequest) {
    String token = "";
    final String authorization = httpServletRequest.getHeader("Authorization");
    if (authorization != null && authorization.toLowerCase().startsWith("bearer")) {
      try {
        token = authorization.split(" ")[1];
      }catch (Exception e) {
        log.error("Error getting token from request");
      }
    }
    return token;
  }
}
