import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <header className="p-4 flex justify-end">
        <ThemeToggle size="sm" />
      </header>
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold text-foreground">404 Page Not Found</h1>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              The page you're looking for doesn't exist.
            </p>
            
            <Link href="/" className="mt-4 inline-block text-primary hover:underline text-sm">
              Go back to home
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
