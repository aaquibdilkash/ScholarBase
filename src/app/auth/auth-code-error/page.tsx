import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AuthCodeError() {
  return (
    <main className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>Authentication Error</CardTitle>
          <CardDescription>
            There was a problem authenticating your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            The link you used may have expired or been used already. Please try
            requesting a new password reset link.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
