import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { HotelSearchForm } from "../components/HotelSearchForm";
import { LoadingState } from "../components/LoadingState";
import { SearchResult } from "../components/SearchResult";
import { ErrorMessage } from "../components/ErrorMessage";
import { SearchApiResponse } from "../types/hotel";

describe("Frontend Components Test Suite", () => {
  describe("HotelSearchForm", () => {
    it("1. Form Rendering: renders all input fields and submit button", () => {
      const mockSearch = jest.fn();
      render(<HotelSearchForm isLoading={false} onSearch={mockSearch} />);

      expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/check-in date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/check-out date/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /search hotels/i }),
      ).toBeInTheDocument();
    });

    it("2. Form Validation: displays error messages when required fields are missing", () => {
      const mockSearch = jest.fn();
      render(<HotelSearchForm isLoading={false} onSearch={mockSearch} />);

      const submitBtn = screen.getByRole("button", { name: /search hotels/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/city is required/i)).toBeInTheDocument();
      expect(screen.getByText(/check-in date is required/i)).toBeInTheDocument();
      expect(screen.getByText(/check-out date is required/i)).toBeInTheDocument();
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("2b. Form Validation: displays error when check-out is not after check-in", () => {
      const mockSearch = jest.fn();
      render(<HotelSearchForm isLoading={false} onSearch={mockSearch} />);

      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: "Dubai" },
      });
      fireEvent.change(screen.getByLabelText(/check-in date/i), {
        target: { value: "2026-10-15" },
      });
      fireEvent.change(screen.getByLabelText(/check-out date/i), {
        target: { value: "2026-10-10" },
      });

      const submitBtn = screen.getByRole("button", { name: /search hotels/i });
      fireEvent.click(submitBtn);

      expect(
        screen.getByText(/check-out date must be after check-in date/i),
      ).toBeInTheDocument();
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("2c. Form Submission: calls onSearch when inputs are valid", () => {
      const mockSearch = jest.fn();
      render(<HotelSearchForm isLoading={false} onSearch={mockSearch} />);

      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: "Tokyo" },
      });
      fireEvent.change(screen.getByLabelText(/check-in date/i), {
        target: { value: "2026-10-10" },
      });
      fireEvent.change(screen.getByLabelText(/check-out date/i), {
        target: { value: "2026-10-12" },
      });

      const submitBtn = screen.getByRole("button", { name: /search hotels/i });
      fireEvent.click(submitBtn);

      expect(mockSearch).toHaveBeenCalledWith({
        city: "Tokyo",
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
      });
    });

    it("2d. Disabled State: disables inputs and shows loading button when isLoading is true", () => {
      const mockSearch = jest.fn();
      render(<HotelSearchForm isLoading={true} onSearch={mockSearch} />);

      expect(screen.getByLabelText(/city/i)).toBeDisabled();
      expect(screen.getByLabelText(/check-in date/i)).toBeDisabled();
      expect(screen.getByLabelText(/check-out date/i)).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /searching hotels\.\.\./i }),
      ).toBeDisabled();
    });
  });

  describe("LoadingState", () => {
    it("3. Loading State: displays searching text and cancel button", () => {
      const mockCancel = jest.fn();
      render(<LoadingState onCancel={mockCancel} />);

      expect(
        screen.getByText(/searching hotels across suppliers\.\.\./i),
      ).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", { name: /cancel search/i });
      expect(cancelBtn).toBeInTheDocument();

      fireEvent.click(cancelBtn);
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("SearchResult", () => {
    it("4. Success State: displays best hotel rate details, name, price, and supplier", () => {
      const sampleResult: SearchApiResponse = {
        workflowId: "hotel-search-12345",
        hotelId: "hotel-a-101",
        name: "Grand Dubai Hotel",
        price: 120,
        supplier: "A",
        status: "SUCCESS",
      };

      render(<SearchResult result={sampleResult} />);

      expect(screen.getByText(/best hotel rate/i)).toBeInTheDocument();
      expect(screen.getByText("Grand Dubai Hotel")).toBeInTheDocument();
      expect(screen.getByText("$120")).toBeInTheDocument();
      expect(screen.getByText("Supplier A")).toBeInTheDocument();
    });
  });

  describe("ErrorMessage", () => {
    it("5. Error State: renders user-friendly error message", () => {
      render(
        <ErrorMessage message="No hotels found for the selected dates." />,
      );

      expect(
        screen.getByText("No hotels found for the selected dates."),
      ).toBeInTheDocument();
    });

    it("5b. Empty Error State: renders nothing when message is empty", () => {
      const { container } = render(<ErrorMessage message="" />);
      expect(container.firstChild).toBeNull();
    });
  });
});
