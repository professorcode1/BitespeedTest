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

CREATE FUNCTION does_contact_alread_exist(
    d_email VARCHAR(100),
    d_phoneNumber VARCHAR(20)
) RETURNS BOOLEAN   
DETERMINISTIC
READS SQL DATA
BEGIN   
DECLARE res BOOLEAN DEFAULT FALSE;  
SELECT count(id)>0 INTO res FROM contact 
    WHERE phoneNumber = d_phoneNumber 
    AND email = d_email;  
RETURN res;  
END $$  

CREATE PROCEDURE get_all_assosiated_contacts_for_this_entity(
    d_email VARCHAR(100) ,
    d_phoneNumber VARCHAR(20)
) BEGIN
WITH RECURSIVE main_data_collector as (
    SELECT email,phoneNumber,id,linkPrecedence , json_array(id) as encountered_ids
    FROM contact 
    WHERE phoneNumber = d_phoneNumber or email = d_email
        union all 
    SELECT 
		contact.email,
        contact.phoneNumber,
        contact.id, 
        contact.linkPrecedence,
        json_merge(
			json_array(contact.id), 
            encountered_ids
		)
    FROM contact  
    INNER JOIN main_data_collector 
    ON (
		main_data_collector.phoneNumber = contact.phoneNumber
        OR main_data_collector.email = contact.email
	) and not (
		JSON_CONTAINS(
			encountered_ids, 
            CONVERT(contact.id,char), 
            '$'
		)
	)
)
select distinct email,phoneNumber,id,linkPrecedence  from main_data_collector;
END $$



CREATE PROCEDURE get_contact_metadata(
    d_email VARCHAR(100) ,
    d_phoneNumber VARCHAR(20)
) BEGIN
    select 
        count(*) as row_count,
        if(email = d_email and phoneNumber = d_phoneNumber, true,false) as BothMatch,
        if(email = d_email,true,false ) as MailMatch,
        if(phoneNumber = d_phoneNumber, true,false) as NumberMatch
    from contact
    where email = d_email or phoneNumber = d_phoneNumber
    group by BothMatch, MailMatch,NumberMatch
    ;
END $$

DELIMITER ; 
CALL populate_db_with_test_data();
-- SELECT does_customer_alread_exist("mcfly@hillvalley.edu", "122456");
-- SELECT does_customer_alread_exist("mcfly@hillvalley.edu", null);
-- SELECT does_customer_alread_exist(NULL, "123456");
-- CALL get_all_assosiated_contacts_for_this_entity("lorraine@hillvalley.edu", null);
CALL get_contact_metadata("lorraine@hillvalley.edu", "123456")