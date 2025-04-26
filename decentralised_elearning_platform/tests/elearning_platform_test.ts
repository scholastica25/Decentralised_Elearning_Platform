import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure student profile creation works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const student1 = accounts.get('wallet_1')!;
        const student2 = accounts.get('wallet_2')!;

        // Create a student profile
        const studentName = "Alice Johnson";
        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii(studentName)],
                student1.address
            )
        ]);

        // Check if profile creation was successful
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify profile details
        const profileCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-student-profile',
            [types.principal(student1.address)],
            student1.address
        );

        const profileString = profileCheck.result.replace('(some ', '').slice(0, -1);
        assertEquals(profileString.includes(`name: "${studentName}"`), true);
        assertEquals(profileString.includes('completed-courses: u0'), true);
        assertEquals(profileString.includes('total-spent: u0'), true);
        assertEquals(profileString.includes('joined-at: u'), true);

        // Try to create a profile with the same principal (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Duplicate Profile")],
                student1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u102)'); // err-already-exists

        // Create another profile with different principal (should succeed)
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Bob Smith")],
                student2.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
    },
});

Clarinet.test({
    name: "Test updating student preferences",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const student1 = accounts.get('wallet_1')!;

        // Create a student profile first
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Caroline Davis")],
                student1.address
            )
        ]);

        // Update preferences
        const preferences = [
            "Programming",
            "Data Science",
            "Machine Learning",
            "Web Development",
            "Blockchain"
        ];

        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'update-student-preferences',
                [types.list(preferences.map(p => types.ascii(p)))],
                student1.address
            )
        ]);

        // Check if preference update was successful
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify updated preferences
        const profileCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-student-profile',
            [types.principal(student1.address)],
            student1.address
        );

        const profileString = profileCheck.result.replace('(some ', '').slice(0, -1);
        preferences.forEach(preference =>
        {
            assertEquals(profileString.includes(`"${preference}"`), true);
        });

        // Test updating preferences for non-existent profile
        const student2 = accounts.get('wallet_2')!;
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'update-student-preferences',
                [types.list(preferences.map(p => types.ascii(p)))],
                student2.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u101)'); // err-not-found
    },
});

Clarinet.test({
    name: "Test instructor details and course creation",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const instructor = accounts.get('wallet_3')!;

        // First, create instructor details manually for testing
        // (normally this would be a separate function)
        // We're inserting directly to the map for testing purposes
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-instructor',
                [
                    types.ascii("Dr. David Lee"),
                    types.ascii("PhD in Computer Science, 10+ years teaching experience"),
                    types.ascii("I specialize in blockchain technology and distributed systems")
                ],
                instructor.address
            )
        ]);

        // Create a course
        const courseTitle = "Blockchain Fundamentals";
        const coursePrice = 50000000; // 50 STX
        const contentHash = "QmT8JZ3NCdaM7YvQ5yTTWvZ4mSriryLUqFBgqxg4Mqy6xZ";
        const category = "Blockchain";
        const description = "Learn the fundamentals of blockchain technology and cryptocurrencies";
        const prerequisites: number[] = []; // No prerequisites

        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii(courseTitle),
                    types.uint(coursePrice),
                    types.ascii(contentHash),
                    types.ascii(category),
                    types.ascii(description),
                    types.list(prerequisites.map(p => types.uint(p)))
                ],
                instructor.address
            )
        ]);

        // Check if course creation was successful
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok u1)'); // First course ID

        // Verify course details
        const courseCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-course',
            [types.uint(1)],
            instructor.address
        );

        const courseString = courseCheck.result.replace('(some ', '').slice(0, -1);
        assertEquals(courseString.includes(`title: "${courseTitle}"`), true);
        assertEquals(courseString.includes(`instructor: ${instructor.address}`), true);
        assertEquals(courseString.includes(`price: u${coursePrice}`), true);
        assertEquals(courseString.includes(`category: "${category}"`), true);
        assertEquals(courseString.includes('total-students: u0'), true);
        assertEquals(courseString.includes('is-active: true'), true);

        // Try to create a course without being an instructor
        const nonInstructor = accounts.get('wallet_4')!;
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Invalid Course"),
                    types.uint(10000000),
                    types.ascii("InvalidHash"),
                    types.ascii("Invalid"),
                    types.ascii("This course should not be created"),
                    types.list([])
                ],
                nonInstructor.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // err-unauthorized
    },
});

Clarinet.test({
    name: "Test course prerequisites and validation",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const instructor = accounts.get('wallet_3')!;
        const student = accounts.get('wallet_1')!;

        // Set up instructor and student
        chain.mineBlock([
            // Create instructor
            Tx.contractCall(
                'elearning_platform',
                'create-instructor',
                [
                    types.ascii("Prof. Rodriguez"),
                    types.ascii("Computer Science Professor"),
                    types.ascii("Specialized in programming languages and software engineering")
                ],
                instructor.address
            ),
            // Create student profile
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Lucas Miller")],
                student.address
            )
        ]);

        // Create a basic course (prerequisite)
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Programming Basics"),
                    types.uint(30000000), // 30 STX
                    types.ascii("QmBasicProgrammingHash"),
                    types.ascii("Programming"),
                    types.ascii("Introduction to programming concepts and syntax"),
                    types.list([])
                ],
                instructor.address
            )
        ]);

        // Create an advanced course with the first course as prerequisite
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Advanced Programming"),
                    types.uint(70000000), // 70 STX
                    types.ascii("QmAdvancedProgrammingHash"),
                    types.ascii("Programming"),
                    types.ascii("Advanced programming techniques and patterns"),
                    types.list([types.uint(1)]) // Course 1 as prerequisite
                ],
                instructor.address
            )
        ]);

        // Try to enroll in advanced course without completing prerequisite
        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(2)], // Advanced course
                student.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u104)'); // err-invalid-input (prerequisites not met)

        // Enroll in the basic course
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(1)], // Basic course
                student.address
            )
        ]);

        // Complete the basic course
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'update-progress',
                [types.uint(1), types.uint(100)],
                student.address
            ),
            Tx.contractCall(
                'elearning_platform',
                'complete-course',
                [types.uint(1)],
                student.address
            )
        ]);

        // Now try to enroll in the advanced course (should succeed)
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(2)], // Advanced course
                student.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify enrollment in advanced course
        const enrollmentCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-enrollment',
            [types.principal(student.address), types.uint(2)],
            student.address
        );

        const enrollmentString = enrollmentCheck.result.replace('(some ', '').slice(0, -1);
        assertEquals(enrollmentString.includes('enrolled-at: u'), true);
    },
});

Clarinet.test({
    name: "Test course rating and instructor ratings",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const instructor = accounts.get('wallet_3')!;
        const student1 = accounts.get('wallet_1')!;
        const student2 = accounts.get('wallet_2')!;

        // Set up instructor and students
        chain.mineBlock([
            // Create instructor
            Tx.contractCall(
                'elearning_platform',
                'create-instructor',
                [
                    types.ascii("Dr. Garcia"),
                    types.ascii("Mathematics Professor"),
                    types.ascii("Teaching calculus and statistics for over 10 years")
                ],
                instructor.address
            ),
            // Create student profiles
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Ava Johnson")],
                student1.address
            ),
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Ethan Wright")],
                student2.address
            )
        ]);

        // Create a course
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Statistics for Data Science"),
                    types.uint(60000000), // 60 STX
                    types.ascii("QmStatsCourseHash"),
                    types.ascii("Mathematics"),
                    types.ascii("Statistical methods and their applications in data science"),
                    types.list([])
                ],
                instructor.address
            )
        ]);

        // Enroll students and complete course
        chain.mineBlock([
            // Student 1
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(1)],
                student1.address
            ),
            // Student 2
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(1)],
                student2.address
            )
        ]);

        chain.mineBlock([
            // Complete course - Student 1
            Tx.contractCall(
                'elearning_platform',
                'update-progress',
                [types.uint(1), types.uint(100)],
                student1.address
            ),
            Tx.contractCall(
                'elearning_platform',
                'complete-course',
                [types.uint(1)],
                student1.address
            ),
            // Complete course - Student 2
            Tx.contractCall(
                'elearning_platform',
                'update-progress',
                [types.uint(1), types.uint(100)],
                student2.address
            ),
            Tx.contractCall(
                'elearning_platform',
                'complete-course',
                [types.uint(1)],
                student2.address
            )
        ]);

        // Rate the course - Student 1
        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'rate-course',
                [types.uint(1), types.uint(4)], // 4 out of 5 stars
                student1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Rate the course - Student 2
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'rate-course',
                [types.uint(1), types.uint(5)], // 5 out of 5 stars
                student2.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check course average rating (should be 4.5)
        const courseCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-course',
            [types.uint(1)],
            deployer.address
        );

        const courseString = courseCheck.result.replace('(some ', '').slice(0, -1);
        // For uint, we would see 4 (rounded down from 4.5)
        assertEquals(courseString.includes('average-rating: u4'), true);
        assertEquals(courseString.includes('total-ratings: u2'), true);

        // Check instructor rating (should reflect course ratings)
        const instructorCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-instructor',
            [types.principal(instructor.address)],
            deployer.address
        );

        const instructorString = instructorCheck.result.replace('(some ', '').slice(0, -1);
        assertEquals(instructorString.includes('rating: u4'), true); // Again, rounded down
        assertEquals(instructorString.includes('total-reviews: u2'), true);

        // Try to rate a course without completing it
        // First create another course
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Probability Theory"),
                    types.uint(50000000), // 50 STX
                    types.ascii("QmProbCourseHash"),
                    types.ascii("Mathematics"),
                    types.ascii("Introduction to probability theory and applications"),
                    types.list([])
                ],
                instructor.address
            )
        ]);

        // Enroll but don't complete
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(2)],
                student1.address
            )
        ]);

        // Try to rate (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'rate-course',
                [types.uint(2), types.uint(3)],
                student1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // err-unauthorized (course not completed)
    },
});

Clarinet.test({
    name: "Test course enrollment and progress tracking",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const instructor = accounts.get('wallet_3')!;
        const student = accounts.get('wallet_1')!;

        // Set up instructor and student
        chain.mineBlock([
            // Create instructor
            Tx.contractCall(
                'elearning_platform',
                'create-instructor',
                [
                    types.ascii("Prof. Johnson"),
                    types.ascii("Master of Computer Science"),
                    types.ascii("Expert in web development and cloud computing")
                ],
                instructor.address
            ),
            // Create student profile
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Emma Wilson")],
                student.address
            )
        ]);

        // Create a course
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Web Development Bootcamp"),
                    types.uint(75000000), // 75 STX
                    types.ascii("QmHash123ForWebDev"),
                    types.ascii("Web Development"),
                    types.ascii("Comprehensive web development course from basics to advanced"),
                    types.list([])
                ],
                instructor.address
            )
        ]);

        // Enroll in the course
        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(1)],
                student.address
            )
        ]);

        // Check if enrollment was successful
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify enrollment details
        const enrollmentCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-enrollment',
            [types.principal(student.address), types.uint(1)],
            student.address
        );

        const enrollmentString = enrollmentCheck.result.replace('(some ', '').slice(0, -1);
        assertEquals(enrollmentString.includes('enrolled-at: u'), true);
        assertEquals(enrollmentString.includes('completed: false'), true);
        assertEquals(enrollmentString.includes('progress: u0'), true);

        // Update progress
        const progressValue = 50; // 50% progress
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'update-progress',
                [types.uint(1), types.uint(progressValue)],
                student.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify updated progress
        const updatedEnrollment = chain.callReadOnlyFn(
            'elearning_platform',
            'get-enrollment',
            [types.principal(student.address), types.uint(1)],
            student.address
        );

        const updatedString = updatedEnrollment.result.replace('(some ', '').slice(0, -1);
        assertEquals(updatedString.includes(`progress: u${progressValue}`), true);
        assertEquals(updatedString.includes('last-accessed: u'), true);

        // Update progress again to 100%
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'update-progress',
                [types.uint(1), types.uint(100)],
                student.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Mark course as complete
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'complete-course',
                [types.uint(1)],
                student.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify course is marked as completed
        const completedEnrollment = chain.callReadOnlyFn(
            'elearning_platform',
            'get-enrollment',
            [types.principal(student.address), types.uint(1)],
            student.address
        );

        const completedString = completedEnrollment.result.replace('(some ', '').slice(0, -1);
        assertEquals(completedString.includes('completed: true'), true);
    },
});

Clarinet.test({
    name: "Test certificate generation for completed courses",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const instructor = accounts.get('wallet_3')!;
        const student = accounts.get('wallet_1')!;

        // Set up instructor, student, course, and complete it
        chain.mineBlock([
            // Create instructor
            Tx.contractCall(
                'elearning_platform',
                'create-instructor',
                [
                    types.ascii("Prof. Williams"),
                    types.ascii("Computer Science Professor"),
                    types.ascii("Teaching programming for 15 years")
                ],
                instructor.address
            ),
            // Create student profile
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Noah Brown")],
                student.address
            )
        ]);

        chain.mineBlock([
            // Create course
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Python Programming"),
                    types.uint(50000000), // 50 STX
                    types.ascii("QmPythonCourseHash"),
                    types.ascii("Programming"),
                    types.ascii("Learn Python from scratch to advanced topics"),
                    types.list([])
                ],
                instructor.address
            )
        ]);

        chain.mineBlock([
            // Enroll in course
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(1)],
                student.address
            ),
            // Set progress to 100%
            Tx.contractCall(
                'elearning_platform',
                'update-progress',
                [types.uint(1), types.uint(100)],
                student.address
            ),
            // Mark as complete
            Tx.contractCall(
                'elearning_platform',
                'complete-course',
                [types.uint(1)],
                student.address
            )
        ]);

        // Generate certificate
        const certificateHash = "QmCertificateHash123ForPython";
        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'generate-certificate',
                [types.uint(1), types.ascii(certificateHash)],
                student.address
            )
        ]);

        // Check if certificate generation was successful
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify certificate details
        const enrollmentCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-enrollment',
            [types.principal(student.address), types.uint(1)],
            student.address
        );

        const enrollmentString = enrollmentCheck.result.replace('(some ', '').slice(0, -1);
        assertEquals(enrollmentString.includes(`completion-certificate: (some "${certificateHash}")`), true);

        // Try to generate certificate for non-completed course
        // First create a new course and enroll
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("JavaScript Basics"),
                    types.uint(40000000), // 40 STX
                    types.ascii("QmJSCourseHash"),
                    types.ascii("Programming"),
                    types.ascii("Introduction to JavaScript programming"),
                    types.list([])
                ],
                instructor.address
            ),
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(2)],
                student.address
            )
        ]);

        // Try to generate certificate (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'generate-certificate',
                [types.uint(2), types.ascii("InvalidCertificateHash")],
                student.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // err-unauthorized
    },
});

Clarinet.test({
    name: "Test discussion forum functionality",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const instructor = accounts.get('wallet_3')!;
        const student1 = accounts.get('wallet_1')!;
        const student2 = accounts.get('wallet_2')!;

        // Set up instructor and students
        chain.mineBlock([
            // Create instructor
            Tx.contractCall(
                'elearning_platform',
                'create-instructor',
                [
                    types.ascii("Dr. Martinez"),
                    types.ascii("PhD in Data Science"),
                    types.ascii("Data science instructor with industry experience")
                ],
                instructor.address
            ),
            // Create student profiles
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Olivia Taylor")],
                student1.address
            ),
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("William Clark")],
                student2.address
            )
        ]);

        // Create a course
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Data Science Masterclass"),
                    types.uint(80000000), // 80 STX
                    types.ascii("QmDataScienceCourseHash"),
                    types.ascii("Data Science"),
                    types.ascii("Comprehensive data science course with real-world projects"),
                    types.list([])
                ],
                instructor.address
            )
        ]);

        // Enroll students
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(1)],
                student1.address
            ),
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(1)],
                student2.address
            )
        ]);

        // Create a discussion post
        const postContent = "I'm having trouble understanding the clustering algorithms. Can someone help?";
        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-discussion-post',
                [types.uint(1), types.ascii(postContent)],
                student1.address
            )
        ]);

        // Check if post creation was successful
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok u1)'); // First post ID

        // Verify post details
        const postCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-discussion-post',
            [types.uint(1), types.uint(1)],
            student1.address
        );

        const postString = postCheck.result.replace('(some ', '').slice(0, -1);
        assertEquals(postString.includes(`author: ${student1.address}`), true);
        assertEquals(postString.includes(`content: "${postContent}"`), true);
        assertEquals(postString.includes('upvotes: u0'), true);

        // Upvote the post
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'upvote-post',
                [types.uint(1), types.uint(1)],
                student2.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify upvote was counted
        const updatedPost = chain.callReadOnlyFn(
            'elearning_platform',
            'get-discussion-post',
            [types.uint(1), types.uint(1)],
            student1.address
        );

        const updatedPostString = updatedPost.result.replace('(some ', '').slice(0, -1);
        assertEquals(updatedPostString.includes('upvotes: u1'), true);

        // Create another post from a different student
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-discussion-post',
                [types.uint(1), types.ascii("I can help with clustering algorithms. Let's schedule a study session.")],
                student2.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok u2)'); // Second post ID

        // Try to create post for a course not enrolled in
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Machine Learning Basics"),
                    types.uint(60000000), // 60 STX
                    types.ascii("QmMLCourseHash"),
                    types.ascii("Machine Learning"),
                    types.ascii("Introduction to machine learning concepts"),
                    types.list([])
                ],
                instructor.address
            )
        ]);

        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-discussion-post',
                [types.uint(2), types.ascii("This post should fail because I'm not enrolled")],
                student1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // err-unauthorized
    },
});

Clarinet.test({
    name: "Test instructor earnings and withdrawal",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const instructor = accounts.get('wallet_3')!;
        const student = accounts.get('wallet_1')!;

        // Set up instructor and student
        chain.mineBlock([
            // Create instructor
            Tx.contractCall(
                'elearning_platform',
                'create-instructor',
                [
                    types.ascii("Prof. Thompson"),
                    types.ascii("Computer Engineering Professor"),
                    types.ascii("Expert in computer architecture and systems")
                ],
                instructor.address
            ),
            // Create student profile
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("Sophia Anderson")],
                student.address
            )
        ]);

        // Create a course
        const coursePrice = 100000000; // 100 STX
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-course',
                [
                    types.ascii("Computer Architecture"),
                    types.uint(coursePrice),
                    types.ascii("QmCompArchCourseHash"),
                    types.ascii("Computer Engineering"),
                    types.ascii("Detailed study of computer architecture and organization"),
                    types.list([])
                ],
                instructor.address
            )
        ]);

        // Student enrolls in the course
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'enroll-in-course',
                [types.uint(1)],
                student.address
            )
        ]);

        // Check instructor earnings
        // Platform fee is 5%, so instructor should get 95 STX
        const expectedEarnings = coursePrice * 95 / 100; // 95 STX
        const instructorDetails = chain.callReadOnlyFn(
            'elearning_platform',
            'get-instructor',
            [types.principal(instructor.address)],
            instructor.address
        );

        const instructorString = instructorDetails.result.replace('(some ', '').slice(0, -1);
        assertEquals(instructorString.includes(`total-earnings: u${expectedEarnings}`), true);

        // Withdraw half the earnings
        const withdrawAmount = expectedEarnings / 2;
        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'withdraw-earnings',
                [types.uint(withdrawAmount)],
                instructor.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify remaining earnings
        const updatedInstructor = chain.callReadOnlyFn(
            'elearning_platform',
            'get-instructor',
            [types.principal(instructor.address)],
            instructor.address
        );

        const updatedString = updatedInstructor.result.replace('(some ', '').slice(0, -1);
        assertEquals(updatedString.includes(`total-earnings: u${expectedEarnings - withdrawAmount}`), true);

        // Try to withdraw more than available
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'withdraw-earnings',
                [types.uint(expectedEarnings)], // More than remaining
                instructor.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u106)'); // err-insufficient-balance
    },
});

Clarinet.test({
    name: "Test platform fee management",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;

        // Check initial platform fee
        let platformFee = chain.callReadOnlyFn(
            'elearning_platform',
            'get-platform-fee',
            [],
            deployer.address
        );

        assertEquals(platformFee.result, 'u5'); // Default 5%

        // Update platform fee
        const newFee = 10; // 10%
        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'set-platform-fee',
                [types.uint(newFee)],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify updated fee
        platformFee = chain.callReadOnlyFn(
            'elearning_platform',
            'get-platform-fee',
            [],
            deployer.address
        );

        assertEquals(platformFee.result, `u${newFee}`);

        // Try to set fee as non-owner (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'set-platform-fee',
                [types.uint(7)],
                user.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // err-unauthorized

        // Try to set fee greater than 100% (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'set-platform-fee',
                [types.uint(101)],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // err-unauthorized
    },
});

Clarinet.test({
    name: "Test student achievements system",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const student = accounts.get('wallet_1')!;

        // Create student profile
        chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'create-student-profile',
                [types.ascii("James Wilson")],
                student.address
            )
        ]);

        // Award achievement
        const achievement = "Early Adopter";
        let block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'award-achievement',
                [types.principal(student.address), types.ascii(achievement)],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify achievement was added
        const profileCheck = chain.callReadOnlyFn(
            'elearning_platform',
            'get-student-profile',
            [types.principal(student.address)],
            student.address
        );

        const profileString = profileCheck.result.replace('(some ', '').slice(0, -1);
        assertEquals(profileString.includes(`"${achievement}"`), true);

        // Award another achievement
        const secondAchievement = "Course Completer";
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'award-achievement',
                [types.principal(student.address), types.ascii(secondAchievement)],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify both achievements
        const updatedProfile = chain.callReadOnlyFn(
            'elearning_platform',
            'get-student-profile',
            [types.principal(student.address)],
            student.address
        );

        const updatedString = updatedProfile.result.replace('(some ', '').slice(0, -1);
        assertEquals(updatedString.includes(`"${achievement}"`), true);
        assertEquals(updatedString.includes(`"${secondAchievement}"`), true);

        // Try to award achievement as non-owner (should fail)
        const nonOwner = accounts.get('wallet_2')!;
        block = chain.mineBlock([
            Tx.contractCall(
                'elearning_platform',
                'award-achievement',
                [types.principal(student.address), types.ascii("Unauthorized Achievement")],
                nonOwner.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103'); // err-unauthorized
    },
});