import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAdminPaymentGateways, updatePaymentGateway, setDefaultPaymentGateway } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, Settings, Check } from "lucide-react";
import {
    AnzEGateCredentialsSchema,
    BredBankCredentialsSchema,
    BspBankCredentialsSchema,
    GenericLocalBankCredentialsSchema,
    StripeCredentialsSchema,
    StripeConfigSchema,
    GooglePayCredentialsSchema,
    ApplePayCredentialsSchema,
    PayPalCredentialsSchema,
    EWalletCredentialsSchema,
    MastercardGatewayCredentialsSchema,
    WanTokCredentialsSchema,
    DigicelMobileMoneyCredentialsSchema,
    KwikPayCredentialsSchema,
    LocalEWalletConfigSchema,
    LocalBankConfigSchema,
    DigitalWalletConfigSchema,
    InternationalFallbackConfigSchema,
} from "@shared/schema";
import { z } from "zod"; // Import z from zod
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


// Helper to map gateway slugs to their respective Zod schemas
const gatewaySchemas: Record<string, { credentials?: z.ZodObject<any>, config?: z.ZodObject<any> }> = {
    'anz-egate': { credentials: AnzEGateCredentialsSchema, config: LocalBankConfigSchema },
    'bred-bank': { credentials: BredBankCredentialsSchema, config: LocalBankConfigSchema },
    'bsp-bank': { credentials: BspBankCredentialsSchema, config: LocalBankConfigSchema },
    'generic-local-bank': { credentials: GenericLocalBankCredentialsSchema, config: LocalBankConfigSchema },
    'stripe': { credentials: StripeCredentialsSchema, config: StripeConfigSchema },
    'google-pay': { credentials: GooglePayCredentialsSchema, config: DigitalWalletConfigSchema },
    'apple-pay': { credentials: ApplePayCredentialsSchema, config: DigitalWalletConfigSchema },
    'paypal': { credentials: PayPalCredentialsSchema, config: InternationalFallbackConfigSchema },
    'e-wallet': { credentials: EWalletCredentialsSchema, config: LocalEWalletConfigSchema },
    'mastercard-gateway': { credentials: MastercardGatewayCredentialsSchema, config: LocalBankConfigSchema },
    // NEW E-Wallets
    'wantok-money': { credentials: WanTokCredentialsSchema, config: LocalEWalletConfigSchema },
    'digicel-mobile-money': { credentials: DigicelMobileMoneyCredentialsSchema, config: LocalEWalletConfigSchema },
    'kwikpay': { credentials: KwikPayCredentialsSchema, config: LocalEWalletConfigSchema },
};

export default function AdminPayments() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedGateway, setSelectedGateway] = useState<any>(null);
    const [credentials, setCredentials] = useState<Record<string, any>>({});
    const [config, setConfig] = useState<Record<string, any>>({});
    const [credentialsErrors, setCredentialsErrors] = useState<Record<string, string | undefined>>({});
    const [configErrors, setConfigErrors] = useState<Record<string, string | undefined>>({});

    const { data: gateways = [], isLoading, error } = useQuery({
        queryKey: ["payment-gateways"],
        queryFn: fetchAdminPaymentGateways,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updatePaymentGateway(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payment-gateways"] });
            toast({ title: t("cms.updated"), description: "Gateway settings saved." });
            setSelectedGateway(null);
            setCredentials({});
            setConfig({});
            setCredentialsErrors({});
            setConfigErrors({});
        },
        onError: (error: any) => {
            console.error("Failed to update gateway:", error);
            const errorMessage = error.response?.data?.error || "Failed to update gateway.";
            const errorDetails = error.response?.data?.details?.fieldErrors || {};

            // If it's a Zod error, try to map it to credentials/config
            if (errorDetails) {
                const newCredentialsErrors: Record<string, string> = {};
                const newConfigErrors: Record<string, string> = {};
                if (errorDetails.credentials) {
                    Object.entries(errorDetails.credentials).forEach(([key, value]) => {
                        newCredentialsErrors[key] = (value as string[])[0];
                    });
                }
                if (errorDetails.config) {
                    Object.entries(errorDetails.config).forEach(([key, value]) => {
                        newConfigErrors[key] = (value as string[])[0];
                    });
                }
                setCredentialsErrors(newCredentialsErrors);
                setConfigErrors(newConfigErrors);
            }
            toast({ title: t("common.error"), description: errorMessage, variant: "destructive" });
        },
    });

    const defaultMutation = useMutation({
        mutationFn: setDefaultPaymentGateway,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payment-gateways"] });
            toast({ title: t("cms.updated"), description: "Default gateway updated." });
        },
    });

    const handleConfigure = (gateway: any) => {
        setSelectedGateway(gateway);
        setCredentials(gateway.credentials || {});
        setConfig(gateway.config || {});
        setCredentialsErrors({}); // Clear errors when opening new dialog
        setConfigErrors({}); // Clear errors when opening new dialog
    };

    const handleCredentialChange = (key: string, value: string) => {
        setCredentials(prev => ({ ...prev, [key]: value }));
        setCredentialsErrors(prev => ({ ...prev, [key]: undefined })); // Clear error on change
    };

    const handleConfigChange = (key: string, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setConfigErrors(prev => ({ ...prev, [key]: undefined })); // Clear error on change
    };

    const handleSaveCredentials = () => {
        if (!selectedGateway) return;

        setCredentialsErrors({});
        setConfigErrors({});

        let hasError = false;
        const currentCredentialsSchema = gatewaySchemas[selectedGateway.slug]?.credentials;
        const currentConfigSchema = gatewaySchemas[selectedGateway.slug]?.config;

        let validatedCredentials = credentials;
        if (currentCredentialsSchema) {
            const result = currentCredentialsSchema.safeParse(credentials);
            if (!result.success) {
                const newErrors: Record<string, string> = {};
                result.error.issues.forEach(issue => {
                    if (issue.path[0]) {
                        newErrors[issue.path[0]] = issue.message;
                    }
                });
                setCredentialsErrors(newErrors);
                hasError = true;
                toast({ title: t("common.error"), description: "Please correct credential errors.", variant: "destructive" });
            } else {
                validatedCredentials = result.data;
            }
        }

        let validatedConfig = config;
        if (currentConfigSchema) {
            const result = currentConfigSchema.safeParse(config);
            if (!result.success) {
                const newErrors: Record<string, string> = {};
                result.error.issues.forEach(issue => {
                    if (issue.path[0]) {
                        newErrors[issue.path[0]] = issue.message;
                    }
                });
                setConfigErrors(newErrors);
                hasError = true;
                toast({ title: t("common.error"), description: "Please correct configuration errors.", variant: "destructive" });
            } else {
                validatedConfig = result.data;
            }
        }

        if (hasError) {
            return;
        }

        updateMutation.mutate({
            id: selectedGateway.id,
            data: { credentials: validatedCredentials, config: validatedConfig }
        });
    };

    const toggleActive = (gateway: any) => {
        updateMutation.mutate({
            id: gateway.id,
            data: { active: !gateway.active }
        });
    };

    // Helper to determine if a field should be type="password"
    const isPasswordField = (key: string) => {
        return key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('password');
    };

    if (isLoading) {
        return (
            <DashboardLayout type="admin">
                <div className="flex items-center justify-center min-h-[50vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout type="admin">
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t("payments.title")}</h1>
                    <p className="text-sm text-muted-foreground">{t("payments.description")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gateways.map((gateway) => (
                        <div key={gateway.id} className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                        <CreditCard className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground">{gateway.displayName}</h3>
                                        <div className="flex gap-2 mt-1">
                                            {gateway.active ? (
                                                <Badge variant="default" className="bg-green-500/15 text-green-600 hover:bg-green-500/25 border-none">
                                                    {t("payments.active")}
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">{t("payments.inactive")}</Badge>
                                            )}
                                            {gateway.isDefault && (
                                                <Badge variant="outline" className="border-primary text-primary">
                                                    {t("payments.default")}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Switch
                                    checked={gateway.active}
                                    onCheckedChange={() => toggleActive(gateway)}
                                />
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                                {gateway.description || "No description provided."}
                            </p>

                            <div className="flex gap-2 mt-auto pt-4 border-t border-border">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleConfigure(gateway)}
                                >
                                    <Settings className="h-4 w-4 mr-2" />
                                    {t("payments.configure")}
                                </Button>
                                <Button
                                    variant={gateway.isDefault ? "secondary" : "default"}
                                    size="sm"
                                    className="flex-1"
                                    disabled={gateway.isDefault || !gateway.active}
                                    onClick={() => defaultMutation.mutate(gateway.id)}
                                >
                                    {gateway.isDefault ? <Check className="h-4 w-4 mr-2" /> : null}
                                    {gateway.isDefault ? t("payments.default") : t("payments.setDefault")}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Dialog open={!!selectedGateway} onOpenChange={(open) => !open && setSelectedGateway(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("payments.configure")} {selectedGateway?.displayName}</DialogTitle>
                        <DialogDescription>
                            {t("payments.credentials")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {selectedGateway && gatewaySchemas[selectedGateway.slug]?.credentials && (
                            <>
                                <h4 className="font-semibold text-base">{t("payments.credentials")}</h4>
                                {Object.keys(gatewaySchemas[selectedGateway.slug].credentials!.shape).map(key => {
                                    const fieldError = credentialsErrors[key];
                                    return (
                                        <div className="space-y-2" key={key}>
                                            <Label htmlFor={key}>{key.split(/(?=[A-Z])/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}</Label>
                                            <Input
                                                id={key}
                                                type={isPasswordField(key) ? "password" : "text"}
                                                value={credentials[key] || ""}
                                                onChange={(e) => handleCredentialChange(key, e.target.value)}
                                                placeholder={`Enter ${key.split(/(?=[A-Z])/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}`}
                                                className={fieldError ? "border-destructive" : ""}
                                            />
                                            {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                        {selectedGateway && gatewaySchemas[selectedGateway.slug]?.config && (
                            <>
                                <h4 className="font-semibold text-base mt-6">{t("payments.config")}</h4>
                                {Object.keys(gatewaySchemas[selectedGateway.slug].config!.shape).map(key => {
                                    const fieldError = configErrors[key];
                                    return (
                                        <div className="space-y-2" key={key}>
                                            <Label htmlFor={`config-${key}`}>{key.split(/(?=[A-Z])/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}</Label>
                                            <Input
                                                id={`config-${key}`}
                                                type="text" // Config fields are usually not passwords
                                                value={config[key] || ""}
                                                onChange={(e) => handleConfigChange(key, e.target.value)}
                                                placeholder={`Enter ${key.split(/(?=[A-Z])/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}`}
                                                className={fieldError ? "border-destructive" : ""}
                                            />
                                            {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedGateway(null)}>
                            {t("common.cancel")}
                        </Button>
                        <Button onClick={handleSaveCredentials}>
                            {t("common.save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
