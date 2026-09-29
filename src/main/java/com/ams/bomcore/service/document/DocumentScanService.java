package com.ams.bomcore.service.document;

import jakarta.annotation.PostConstruct;
import org.opencv.core.Core;
import org.opencv.core.CvType;
import org.opencv.core.Mat;
import org.opencv.core.MatOfByte;
import org.opencv.core.MatOfInt;
import org.opencv.core.MatOfPoint2f;
import org.opencv.core.Point;
import org.opencv.core.Size;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.CLAHE;
import org.opencv.imgproc.Imgproc;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

@Service
public class DocumentScanService {

    private static final long MAX_UPLOAD_BYTES = 20L * 1024L * 1024L;
    private static final int MIN_OUTPUT_SIDE = 240;
    private static final int MAX_OUTPUT_SIDE = 2048;

    @PostConstruct
    void loadOpenCv() {
        nu.pattern.OpenCV.loadLocally();
    }

    public ScanResult process(MultipartFile file, List<NormalizedPoint> corners, String requestedMode,
                              Integer requestedMaxDimension) {
        validateUpload(file);
        if (corners == null || corners.size() != 4) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exactly four corners are required");
        }
        corners.forEach(NormalizedPoint::validate);

        int maxDimension = Math.max(512, Math.min(MAX_OUTPUT_SIDE,
                requestedMaxDimension == null ? MAX_OUTPUT_SIDE : requestedMaxDimension));
        ScanMode mode = ScanMode.from(requestedMode);

        Mat encoded = null;
        Mat source = null;
        Mat transform = null;
        Mat warped = null;
        Mat enhanced = null;
        MatOfPoint2f sourcePoints = null;
        MatOfPoint2f targetPoints = null;
        MatOfByte output = null;
        MatOfInt encodingParameters = null;
        try {
            encoded = new MatOfByte(file.getBytes());
            source = Imgcodecs.imdecode(encoded, Imgcodecs.IMREAD_COLOR);
            if (source.empty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded file is not a supported image");
            }

            Point topLeft = corners.get(0).toPoint(source.cols(), source.rows());
            Point topRight = corners.get(1).toPoint(source.cols(), source.rows());
            Point bottomRight = corners.get(2).toPoint(source.cols(), source.rows());
            Point bottomLeft = corners.get(3).toPoint(source.cols(), source.rows());

            double rawWidth = Math.max(distance(topLeft, topRight), distance(bottomLeft, bottomRight));
            double rawHeight = Math.max(distance(topLeft, bottomLeft), distance(topRight, bottomRight));
            if (rawWidth < MIN_OUTPUT_SIDE || rawHeight < MIN_OUTPUT_SIDE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selected document area is too small");
            }
            double outputScale = Math.min(1.0, maxDimension / Math.max(rawWidth, rawHeight));
            int width = Math.max(MIN_OUTPUT_SIDE, (int) Math.round(rawWidth * outputScale));
            int height = Math.max(MIN_OUTPUT_SIDE, (int) Math.round(rawHeight * outputScale));

            sourcePoints = new MatOfPoint2f(topLeft, topRight, bottomRight, bottomLeft);
            targetPoints = new MatOfPoint2f(
                    new Point(0, 0), new Point(width - 1, 0),
                    new Point(width - 1, height - 1), new Point(0, height - 1));
            transform = Imgproc.getPerspectiveTransform(sourcePoints, targetPoints);
            warped = new Mat(height, width, CvType.CV_8UC3);
            Imgproc.warpPerspective(source, warped, transform, new Size(width, height),
                    Imgproc.INTER_CUBIC, Core.BORDER_REPLICATE);

            enhanced = enhance(warped, mode);
            output = new MatOfByte();
            encodingParameters = new MatOfInt(Imgcodecs.IMWRITE_JPEG_QUALITY, 94);
            if (!Imgcodecs.imencode(".jpg", enhanced, output, encodingParameters)) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not encode scanned image");
            }
            return new ScanResult(output.toArray(), width, height, mode.name().toLowerCase(Locale.ROOT));
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded image", error);
        } finally {
            release(encodingParameters, output, enhanced, warped, transform, targetPoints, sourcePoints, source, encoded);
        }
    }

    private Mat enhance(Mat source, ScanMode mode) {
        if (mode == ScanMode.ORIGINAL) {
            return source.clone();
        }
        if (mode == ScanMode.GRAYSCALE) {
            Mat gray = new Mat();
            Mat blurred = new Mat();
            Mat result = new Mat();
            Imgproc.cvtColor(source, gray, Imgproc.COLOR_BGR2GRAY);
            Imgproc.GaussianBlur(gray, blurred, new Size(0, 0), 9);
            Core.divide(gray, blurred, result, 255);
            Imgproc.adaptiveThreshold(result, result, 255,
                    Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C, Imgproc.THRESH_BINARY, 31, 11);
            gray.release();
            blurred.release();
            return result;
        }

        Mat lab = new Mat();
        Mat sharpened = new Mat();
        Mat blurred = new Mat();
        List<Mat> channels = new java.util.ArrayList<>();
        Imgproc.cvtColor(source, lab, Imgproc.COLOR_BGR2Lab);
        Core.split(lab, channels);
        CLAHE clahe = Imgproc.createCLAHE(2.2, new Size(8, 8));
        clahe.apply(channels.get(0), channels.get(0));
        Core.merge(channels, lab);
        Imgproc.cvtColor(lab, sharpened, Imgproc.COLOR_Lab2BGR);
        Imgproc.GaussianBlur(sharpened, blurred, new Size(0, 0), 1.25);
        Core.addWeighted(sharpened, 1.32, blurred, -0.32, 0, sharpened);
        channels.forEach(Mat::release);
        lab.release();
        blurred.release();
        return sharpened;
    }

    private static double distance(Point first, Point second) {
        return Math.hypot(first.x - second.x, first.y - second.y);
    }

    private static void validateUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Image must be 20 MB or smaller");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only image uploads are supported");
        }
    }

    private static void release(Mat... mats) {
        for (Mat mat : mats) {
            if (mat != null) mat.release();
        }
    }

    private enum ScanMode {
        DOCUMENT, GRAYSCALE, ORIGINAL;

        static ScanMode from(String value) {
            if (value == null) return DOCUMENT;
            try {
                return ScanMode.valueOf(value.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mode must be document, grayscale, or original");
            }
        }
    }

    public record NormalizedPoint(double x, double y) {
        void validate() {
            if (!Double.isFinite(x) || !Double.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Corner coordinates must be between 0 and 1");
            }
        }

        Point toPoint(int width, int height) {
            return new Point(x * (width - 1), y * (height - 1));
        }
    }

    public record ScanResult(byte[] image, int width, int height, String mode) {}
}
