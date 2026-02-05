import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";

interface BackButtonProps {
  to?: string;
  label?: string;
}

export default function BackButton({ to, label = "Back" }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="gap-1"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
