package com.demo.prototype;

//Create a Product class that implements Prototype
//Fields: id (String), name (String), price (double)
//Provide constructor, getters, setters
//Implement clone method to return a deep copy of Product
//Override toString for debugging


public class Product implements Prototype {

    private String id;
    private String name;
    private double price;

    public Product() {
    }

    public Product(String id, String name, double price) {
        this.id = id;
        this.name = name;
        this.price = price;
    }

    // Copy constructor used by clone()
    private Product(Product other) {
        this.id = other.id;
        this.name = other.name;
        this.price = other.price;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    @Override
    public Prototype clone() {
        // Strings are immutable, primitive double is copied — deep copy is trivial here
        return new Product(this);
    }

    @Override
    public String toString() {
        return "Product{id='" + id + "', name='" + name + "', price=" + price + "}";
    }
}