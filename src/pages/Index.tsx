import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AIProductsModule } from "@/components/ai-products/AIProductsModule";

const Index = () => {
  return (
    <DashboardLayout>
      <AIProductsModule />
    </DashboardLayout>
  );
};

export default Index;
