import React, { useState } from "react";
import { HotelSearchRequest } from "../types/hotel";

interface HotelSearchFormProps {
  isLoading: boolean;
  onSearch: (request: HotelSearchRequest) => void;
}

export interface FormErrors {
  city?: string;
  checkIn?: string;
  checkOut?: string;
}

export function HotelSearchForm({ isLoading, onSearch }: HotelSearchFormProps) {
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!city.trim()) {
      newErrors.city = "City is required.";
    }

    if (!checkIn) {
      newErrors.checkIn = "Check-in date is required.";
    }

    if (!checkOut) {
      newErrors.checkOut = "Check-out date is required.";
    } else if (checkIn && new Date(checkOut) <= new Date(checkIn)) {
      newErrors.checkOut = "Check-out date must be after check-in date.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    if (validate()) {
      onSearch({
        city: city.trim(),
        checkIn,
        checkOut,
      });
    }
  };

  return (
    <form className="search-form" onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label htmlFor="city-input" className="form-label">
          City
        </label>
        <input
          id="city-input"
          type="text"
          className={`form-input ${errors.city ? "input-error" : ""}`}
          placeholder="e.g. Dubai, Tokyo, Paris"
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            if (errors.city) setErrors((prev) => ({ ...prev, city: undefined }));
          }}
          disabled={isLoading}
        />
        {errors.city && <span className="field-error">{errors.city}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="checkin-input" className="form-label">
            Check-in Date
          </label>
          <input
            id="checkin-input"
            type="date"
            className={`form-input date-input ${errors.checkIn ? "input-error" : ""}`}
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              if (errors.checkIn)
                setErrors((prev) => ({ ...prev, checkIn: undefined }));
            }}
            disabled={isLoading}
          />
          {errors.checkIn && (
            <span className="field-error">{errors.checkIn}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="checkout-input" className="form-label">
            Check-out Date
          </label>
          <input
            id="checkout-input"
            type="date"
            className={`form-input date-input ${errors.checkOut ? "input-error" : ""}`}
            value={checkOut}
            onChange={(e) => {
              setCheckOut(e.target.value);
              if (errors.checkOut)
                setErrors((prev) => ({ ...prev, checkOut: undefined }));
            }}
            disabled={isLoading}
          />
          {errors.checkOut && (
            <span className="field-error">{errors.checkOut}</span>
          )}
        </div>
      </div>

      <button
        id="search-button"
        type="submit"
        className="submit-btn"
        disabled={isLoading}
      >
        {isLoading ? "Searching hotels..." : "Search Hotels"}
      </button>
    </form>
  );
}
