import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface QRScannerProps {
    onScan: (data: string) => void;
    onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const readerIdRef = useRef<string>(`qr-reader-${Date.now()}`);

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            if (scannerRef.current) {
                scannerRef.current
                    .stop()
                    .catch((err) => console.error("Error stopping scanner:", err));
            }
        };
    }, []);

    const startScanning = async () => {
        try {
            setError(null);
            const scanner = new Html5Qrcode(readerIdRef.current);
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                (decodedText) => {
                    // Success callback
                    scanner.stop().then(() => {
                        setIsScanning(false);
                        onScan(decodedText);
                    });
                },
                (errorMessage) => {
                    // Error callback (scanning errors, not critical)
                    // We can ignore these as they happen frequently during scanning
                }
            );

            setIsScanning(true);
        } catch (err: any) {
            console.error("Scanner error:", err);
            setError(err?.message || "Failed to start camera. Please check permissions.");
            setIsScanning(false);
        }
    };

    const stopScanning = () => {
        if (scannerRef.current) {
            scannerRef.current
                .stop()
                .then(() => {
                    setIsScanning(false);
                    scannerRef.current = null;
                })
                .catch((err) => console.error("Error stopping scanner:", err));
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Scan QR Code
                </CardTitle>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        stopScanning();
                        onClose();
                    }}
                >
                    <X className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                <div
                    id={readerIdRef.current}
                    className="w-full rounded-lg overflow-hidden border"
                    style={{ minHeight: isScanning ? "300px" : "0px" }}
                />

                {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {!isScanning && !error && (
                    <div className="text-center py-8">
                        <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-4">
                            Click the button below to start scanning
                        </p>
                    </div>
                )}

                {!isScanning ? (
                    <Button onClick={startScanning} className="w-full">
                        <Camera className="mr-2 h-4 w-4" />
                        Start Scanning
                    </Button>
                ) : (
                    <Button onClick={stopScanning} variant="destructive" className="w-full">
                        Stop Scanning
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
