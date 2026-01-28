'use client';

import * as React from 'react';
import { Button } from './ui/button';

export const SignaturePad = ({ onEnd, onClear, dataUrl }: { onEnd: (dataUrl: string) => void; onClear: () => void; dataUrl?: string | null }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = React.useState(false);
    const [hasSigned, setHasSigned] = React.useState(false);

    const getCoords = (e: MouseEvent | TouchEvent): { x: number, y: number } | null => {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        let clientX, clientY;
        if (e instanceof MouseEvent) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else if ("touches" in e && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else if ("changedTouches" in e && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        } else {
            return null;
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const coords = getCoords(e.nativeEvent);
        if (coords && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(coords.x, coords.y);
                setIsDrawing(true);
                if (!hasSigned) setHasSigned(true);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        e.preventDefault();
        const coords = getCoords(e.nativeEvent);
        if (coords && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.lineTo(coords.x, coords.y);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        if (canvasRef.current) {
            onEnd(canvasRef.current.toDataURL('image/png'));
        }
    };

    const handleClear = () => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            onClear();
            setHasSigned(false);
        }
    };

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (dataUrl) {
            const image = new window.Image();
            image.src = dataUrl;
            image.onload = () => {
                ctx.drawImage(image, 0, 0);
            }
            if(!hasSigned) setHasSigned(true);
        } else {
             if(hasSigned) setHasSigned(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataUrl]);
    
    React.useEffect(() => {
        const preventScroll = (e: TouchEvent) => {
            if (isDrawing) {
                e.preventDefault();
            }
        };
        const canvasElem = canvasRef.current;
        if (canvasElem) {
            canvasElem.addEventListener('touchmove', preventScroll, { passive: false });
        }
        return () => {
            if (canvasElem) {
                canvasElem.removeEventListener('touchmove', preventScroll);
            }
        };
    }, [isDrawing]);


    return (
        <div className="w-full">
            <canvas
                ref={canvasRef}
                width="400"
                height="200"
                className="border rounded-md bg-white w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            {hasSigned && (
                <Button type="button" variant="outline" size="sm" onClick={handleClear} className="mt-2">
                    נקה חתימה
                </Button>
            )}
        </div>
    );
};
