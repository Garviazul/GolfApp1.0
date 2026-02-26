import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface MetricInfoContent {
  title: string;
  what: string;
  calculation: string;
  target: string;
  improve: string[];
}

interface MetricInfoDialogProps {
  content: MetricInfoContent;
  className?: string;
}

export const MetricInfoDialog = ({ content, className }: MetricInfoDialogProps) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7 text-muted-foreground", className)}
        aria-label={`Información sobre ${content.title}`}
      >
        <CircleHelp className="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{content.title}</DialogTitle>
        <DialogDescription>Métrica del dashboard DECADE.</DialogDescription>
      </DialogHeader>

      <div className="space-y-3 text-sm">
        <section>
          <p className="font-semibold">Qué es</p>
          <p className="text-muted-foreground">{content.what}</p>
        </section>

        <section>
          <p className="font-semibold">Cómo se calcula</p>
          <p className="text-muted-foreground">{content.calculation}</p>
        </section>

        <section>
          <p className="font-semibold">Objetivo recomendado</p>
          <p className="text-muted-foreground">{content.target}</p>
        </section>

        <section>
          <p className="font-semibold">Cómo mejorarlo</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {content.improve.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </DialogContent>
  </Dialog>
);
