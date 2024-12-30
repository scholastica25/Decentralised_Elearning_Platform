;; Decentralized E-Learning Platform

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-unauthorized (err u103))
(define-constant err-invalid-input (err u104))
(define-constant err-course-inactive (err u105))
(define-constant err-insufficient-balance (err u106))


;; Data Maps
(define-map courses 
    { course-id: uint }
    {
        title: (string-ascii 100),
        instructor: principal,
        price: uint,
        content-hash: (string-ascii 64),
        is-active: bool,
        category: (string-ascii 50),
        description: (string-ascii 500),
        total-students: uint,
        average-rating: uint,
        total-ratings: uint,
        prerequisites: (list 10 uint),
        created-at: uint
    }
)

(define-map enrollments
    { student: principal, course-id: uint }
    {
        enrolled-at: uint,
        completed: bool,
        rating: (optional uint),
        progress: uint,
        last-accessed: uint,
        completion-certificate: (optional (string-ascii 64))
    }
)

(define-map instructor-details
    { instructor: principal }
    {
        name: (string-ascii 50),
        credentials: (string-ascii 200),
        rating: uint,
        total-reviews: uint,
        total-students: uint,
        total-earnings: uint,
        bio: (string-ascii 500),
        social-links: (list 5 (string-ascii 200))
    }
)

(define-map student-profiles
    { student: principal }
    {
        name: (string-ascii 50),
        completed-courses: uint,
        total-spent: uint,
        achievements: (list 10 (string-ascii 50)),
        joined-at: uint,
        preferences: (list 5 (string-ascii 50))
    }
)

(define-map course-discussions
    { course-id: uint, post-id: uint }
    {
        author: principal,
        content: (string-ascii 500),
        timestamp: uint,
        replies: (list 10 uint),
        upvotes: uint
    }
)
