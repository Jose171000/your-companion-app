import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Si algo falla al pintar, React desmonta toda la aplicación y deja la pantalla en negro sin decir nada.
 * Aquí se muestra un aviso con la opción de volver, y el error queda en la consola para poder revisarlo.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error al mostrar la pantalla:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">Algo salió mal al mostrar esta pantalla</h1>
          <p className="text-sm text-muted-foreground">
            Tus datos no se perdieron. Vuelve a cargar la página; si se repite, avísanos qué estabas haciendo.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Recargar</Button>
            <Button variant="outline" onClick={() => { window.location.href = "/"; }}>Ir al inicio</Button>
          </div>
        </div>
      </div>
    );
  }
}
