import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ItemStatusBadge, MemberStatusBadge, LoanStatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";

describe("Design System UI Components", () => {
  it("renders Button with default variant", () => {
    render(<Button>Click Me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn).toBeTruthy();
  });

  it("renders Badge variants correctly", () => {
    const { container: successBadge } = render(<Badge variant="success">Active</Badge>);
    expect(successBadge.textContent).toBe("Active");

    const { container: rfidBadge } = render(<Badge variant="rfid">EAS Armed</Badge>);
    expect(rfidBadge.textContent).toBe("EAS Armed");
  });

  it("renders Status Badges with correct institutional terminology", () => {
    render(<ItemStatusBadge status="AVAILABLE" />);
    expect(screen.getByText("Available")).toBeTruthy();

    render(<ItemStatusBadge status="REFERENCE_ONLY" />);
    expect(screen.getByText("Reference Only")).toBeTruthy();

    render(<MemberStatusBadge status="BLOCKED" />);
    expect(screen.getByText("Blocked")).toBeTruthy();

    render(<LoanStatusBadge status="OVERDUE" />);
    expect(screen.getByText("Overdue")).toBeTruthy();
  });

  it("renders Card structure completely", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Catalog Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Total items in collection: 4,500</p>
        </CardContent>
      </Card>
    );

    expect(screen.getByText("Catalog Summary")).toBeTruthy();
    expect(screen.getByText(/Total items in collection/i)).toBeTruthy();
  });

  it("renders StatCard with numerical formatting", () => {
    render(
      <StatCard
        label="Total Books"
        value={12500}
        variant="default"
        trend={{ value: 5.2 }}
      />
    );

    expect(screen.getByText("Total Books")).toBeTruthy();
    expect(screen.getByText("12500")).toBeTruthy();
    expect(screen.getByText("+5.2% vs last month")).toBeTruthy();
  });
});

