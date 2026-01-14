import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "./ui/button";

interface QRCodeGeneratorProps {
    data: string;
    size?: number;
    title?: string;
    showDownload?: boolean;
}

export function QRCodeGenerator({ data, size = 200, title, showDownload = true }: QRCodeGeneratorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!canvasRef.current || !data) return;

        QRCode.toCanvas(
            canvasRef.current,
            data,
            {
                width: size,
                margin: 2,
                color: {
                    dark: "#000000",
                    light: "#FFFFFF",
                },
            },
            (err: Error | null | undefined) => {
                if (err) {
                    console.error("QR Code generation error:", err);
                    setError("Failed to generate QR code");
                }
            }
        );
    }, [data, size]);

    const handleDownload = () => {
        if (!canvasRef.current) return;

        canvasRef.current.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `qr-code-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    };

    if (error) {
        return <div className="text-red-500 text-sm">{error}</div>;
    }

    return (
        <div className="flex flex-col items-center gap-3">
            {title && <h3 className="font-semibold text-sm">{title}</h3>}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
                <canvas ref={canvasRef} />
            </div>
            {showDownload && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="gap-2"
                >
                    <Download className="h-4 w-4" />
                    Download QR Code
                </Button>
            )}
        </div>
    );
}
