package com.ams.bomcore.integration.vinhoadon;

/** A transport or HTTP-level failure returned by VIN-HOADON. */
public class VinHoadonApiException extends RuntimeException {

    private final int statusCode;
    private final String responseBody;

    public VinHoadonApiException(String message, int statusCode, String responseBody) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    public VinHoadonApiException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = 0;
        this.responseBody = null;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getResponseBody() {
        return responseBody;
    }
}
