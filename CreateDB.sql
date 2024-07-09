DROP DATABASE IF EXISTS `bitspeeddb`;
CREATE DATABASE `bitspeeddb`;
USE `bitspeeddb`;

CREATE TABLE `contact`(
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `phoneNumber` VARCHAR(20) NULL DEFAULT NULL,
    `email` VARCHAR(100) NULL DEFAULT NULL,
    `linkedId` INT NULL DEFAULT NULL,
    `linkPrecedence`  ENUM('secondary', 'primary') NOT NULL DEFAULT 'primary',
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `deletedAt` DATETIME NULL DEFAULT NUll
)  ;

DELIMITER $$

CREATE TRIGGER validate_the_contact_to_have_one_source
BEFORE INSERT ON `contact`
FOR EACH ROW
BEGIN
    IF NEW.phoneNumber IS NULL AND NEW.email IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Both Email and Phone Number cannot be null';
    END IF;
END$$

CREATE PROCEDURE populate_db_with_test_data()
BEGIN 
		INSERT INTO 
        contact(id, phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt)
        VALUES 
            (
                1, 
                "123456", 
                "lorraine@hillvalley.edu", 
                null, 
                "primary", 
                "2023-04-01 00:00:00", 
                '2023-04-01 00:00:00' , 
                null
            ),
            (
                23,
                "123456",
                "mcfly@hillvalley.edu",
                1,
                "secondary",
                '2023-04-20 05:30:00',
                "2023-04-20 05:30:00",
                null
            )
        ;
END $$
DELIMITER ; 
CALL populate_db_with_test_data();
