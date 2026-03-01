import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { resetPassword } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ResetPassword() {
    const [location] = useLocation();
    const { toast } = useToast();
    const [, setLocation] = useLocation();

    // Extract token from URL search params
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);

    const mutation = useMutation({
        mutationFn: resetPassword,
        onSuccess: () => {
            setIsSuccess(true);
            toast({
                title: "Password Updated",
                description: "Your password has been reset successfully. You can now log in.",
            });
            setTimeout(() => setLocation("/login"), 3000);
        },
        onError: (error: any) => {
            toast({
                title: "Reset Failed",
                description: error.message || "Invalid or expired token. Please request a new link.",
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            toast({ title: "Error", description: "Missing reset token", variant: "destructive" });
            return;
        }
        if (password !== confirmPassword) {
            toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
            return;
        }
        mutation.mutate({ token, newPassword: password });
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-md w-full text-center">
                    <CardHeader>
                        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <ShieldCheck className="w-6 h-6 text-red-600" />
                        </div>
                        <CardTitle>Invalid Link</CardTitle>
                        <CardDescription>
                            This password reset link is invalid or has expired.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button className="w-full" onClick={() => setLocation("/login")}>
                            Go to Login
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#004165] overflow-hidden relative">
            {/* Decorative Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#006699] rounded-full blur-[120px] opacity-20 animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#f97316] rounded-full blur-[120px] opacity-10" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="z-10 w-full max-w-md p-4"
            >
                <Card className="border-none bg-white/10 backdrop-blur-md shadow-2xl text-white">
                    <CardHeader className="text-center space-y-2">
                        <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 border border-white/30">
                            <KeyRound className="w-8 h-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight">Set New Password</CardTitle>
                        <CardDescription className="text-blue-100/70 text-base">
                            Enter your new secure password below to regain access to your account.
                        </CardDescription>
                    </CardHeader>

                    <AnimatePresence mode="wait">
                        {isSuccess ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="p-8 text-center"
                            >
                                <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30">
                                    <ShieldCheck className="w-10 h-10 text-green-400" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Success!</h3>
                                <p className="text-blue-100/70 mb-6">
                                    Your password has been updated. Redirecting you to login...
                                </p>
                                <div className="flex justify-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <form onSubmit={handleSubmit}>
                                    <CardContent className="space-y-4 pt-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="password">New Password</Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                required
                                                className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-white/40 focus:ring-white/20"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                disabled={mutation.isPending}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                                            <Input
                                                id="confirmPassword"
                                                type="password"
                                                required
                                                className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-white/40 focus:ring-white/20"
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                disabled={mutation.isPending}
                                            />
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-4 flex flex-col gap-4">
                                        <Button
                                            type="submit"
                                            className="w-full bg-white text-[#004165] hover:bg-white/90 font-bold py-6 rounded-xl shadow-lg transition-all active:scale-[0.98]"
                                            disabled={mutation.isPending}
                                        >
                                            {mutation.isPending ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Updating...
                                                </>
                                            ) : (
                                                "Reset Password"
                                            )}
                                        </Button>
                                        <p className="text-xs text-center text-blue-100/50">
                                            Ensure your password is at least 8 characters long and includes a mix of letters and numbers.
                                        </p>
                                    </CardFooter>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            </motion.div>
        </div>
    );
}
